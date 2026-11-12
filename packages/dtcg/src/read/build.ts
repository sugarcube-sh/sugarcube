import { relatedMessages } from "../error-messages.js";
import type {
    DesignTokens,
    DiagnosticDetailByKind,
    DiagnosticKind,
    Group,
    Input,
    JsonPath,
    ParseResult,
    Permutation,
    Definition,
    Source,
    Span,
    Token,
    TokenType,
    OriginalProperties,
} from "../model.js";
import { tokenPath } from "../path.js";
import { getReferencePath, toReferenceTarget } from "../values/references.js";
import type { Mutable } from "./building.js";
import { type DiagnosticExtra, diagnostic, type DiagnosticCollector } from "./diagnostics.js";
import {
    type EffectiveSettings,
    getEffectiveSettings,
    findDeprecatingGroup,
    findDeprecation,
    getInheritedProperty,
} from "./inherit.js";
import {
    NO_EXTENSION_DEFINITIONS,
    NO_DEFINITIONS,
    NO_REFERENCES,
    type DefinitionTracker,
    createGroupObject,
    createPermutation,
    createTokenObject,
    allTokens,
} from "./linked.js";
import { checkMalformedPointer } from "./malformed-pointer.js";
import type { Merged, MergedGroup, MergedToken, SourceSpan } from "./merge.js";
import type { MissingRecorder, MissingReferences } from "./missing.js";
import type { NormalisedPermutation } from "./normalise.js";
import { type Occurrence, createAliasOccurrence } from "./occurrence.js";
import type { LocatedReference, ValueReader } from "./parse-value.js";
import { type ReferenceWithTarget, createReference } from "./reference.js";
import { type ReferenceLookup, followReference, getAtPath, toValuePointer } from "./ref-meaning.js";
import { type ReferenceResolver, UNRESOLVED, resolveValue } from "./resolve-value.js";
import { type TokenBuildFields, sameGroup, sameToken } from "./same-object.js";
import { type Properties, toValidType } from "./walk.js";

interface Context {
    readValue: ValueReader;
    diagnostics: DiagnosticCollector;
    tracker: DefinitionTracker;
    missing: MissingReferences;
    reusable: ReusableIndex;
}

interface ReusableIndex {
    tokens: Map<string, Token[]>;
    groups: Map<string, Group[]>;
}

interface PermutationContext {
    input: Input;
    merged: Merged;
    sources: readonly Source[];
    tracker: DefinitionTracker;
    diagnostics: DiagnosticCollector;
    reusable: ReusableIndex;
}

interface Resolved {
    type: TokenType;
    read: ParseResult<unknown>;
    references: LocatedReference[];
    resolved?: unknown;
}

type ResolveResult = Resolved | "untyped";

interface TokenToBuild {
    path: string;
    mergedToken: MergedToken;
    resolved: Resolved;
    targets: readonly TargetLocation[];
    waitsOnLaterToken: boolean;
}

type TargetLocation =
    | { occurrence: Occurrence; isToken: true; path: string; pointsToProperty?: JsonPath }
    | { occurrence: Occurrence; isToken: false; path: string | undefined };

interface GroupBuildFields {
    settings: EffectiveSettings;
    deprecatedByGroup: string | undefined;
    definitions: readonly Definition[];
    children: (Token | Group)[];
    extending: Group | undefined;
}

interface NewToken {
    token: Mutable<Token>;
    tokenToBuild: TokenToBuild;
}

type AliasTarget =
    | { kind: "token"; value: ResolveResult | undefined }
    | { kind: "part" }
    | { kind: "unreachable" };

const RESOLVING = Symbol("resolving");

const NONE: readonly never[] = [];

export function buildPermutations(
    permutations: NormalisedPermutation[],
    { previous, ...rest }: Omit<Context, "reusable"> & { previous: DesignTokens | undefined },
): Permutation[] {
    const context = { ...rest, reusable: indexReusable(previous) };
    return permutations.map((permutation) => buildPermutation(permutation, context));
}

function buildPermutation(permutation: NormalisedPermutation, context: Context): Permutation {
    const { input, merged, sources, unreadSources } = permutation;
    const { readValue, diagnostics, tracker, reusable } = context;
    const missing = context.missing.createRecorder(input, merged.tokens, unreadSources);
    const resolver = new ValueResolver(permutation, readValue, diagnostics, missing);
    const shared = { input, merged, sources, tracker, diagnostics, reusable };

    const tokensToBuild = orderTokens(merged, resolver);
    const tokens = buildTokens(tokensToBuild, shared);
    const groups = buildGroups(tokens, shared);
    missing.flush();

    return toPermutation(permutation, tokens, groups);
}

function orderTokens(merged: Merged, resolver: ValueResolver): TokenToBuild[] {
    const tokensToBuild: TokenToBuild[] = [];
    const visits = new Map<string, "visiting" | "done">();

    const visit = (path: string) => {
        if (visits.has(path)) return;

        const mergedToken = merged.tokens.get(path);
        if (!mergedToken) return;

        visits.set(path, "visiting");
        const resolved = resolver.resolve(mergedToken);
        if (resolved === "untyped") {
            visits.set(path, "done");
            return;
        }

        const targets = locateTargets(resolved.references, merged);
        for (const target of targets) if (target.isToken) visit(target.path);
        const waitsOnLaterToken = targets.some(
            (target) => target.isToken && visits.get(target.path) === "visiting",
        );
        visits.set(path, "done");

        tokensToBuild.push({ path, mergedToken, resolved, targets, waitsOnLaterToken });
    };

    for (const path of merged.tokens.keys()) visit(path);
    return tokensToBuild;
}

function locateTargets(references: LocatedReference[], merged: Merged): readonly TargetLocation[] {
    if (references.length === 0) return NONE;
    return references.map(({ occurrence }) => locateTarget(occurrence, merged));
}

function buildTokens(
    tokensToBuild: TokenToBuild[],
    context: PermutationContext,
): Map<string, Token> {
    const built = new Map<string, Token>();
    const newTokens: NewToken[] = [];

    for (const tokenToBuild of tokensToBuild) {
        const targets = attachTargets(tokenToBuild.targets, built);
        reportDeprecated(tokenToBuild.path, targets, context);

        const fields = getTokenBuildFields(tokenToBuild, context);
        const reused = tokenToBuild.waitsOnLaterToken
            ? undefined
            : findReusableToken(tokenToBuild, fields, targets, context);

        if (reused) {
            const spans = targets.map(({ occurrence }) => occurrence.span);
            context.tracker.recordMoves(reused.references, spans);
            built.set(tokenToBuild.path, reused);
        } else {
            const token = createToken(tokenToBuild.mergedToken, fields, context.reusable);
            newTokens.push({ token, tokenToBuild });
            built.set(tokenToBuild.path, token);
        }
    }

    for (const { token, tokenToBuild } of newTokens) linkReferences(token, tokenToBuild, built);
    return built;
}

function attachTargets(
    locations: readonly TargetLocation[],
    built: ReadonlyMap<string, Token>,
): readonly ReferenceWithTarget[] {
    if (locations.length === 0) return NONE;
    return locations.map((location) => {
        const { occurrence, path } = location;
        if (!location.isToken) return { occurrence, path };

        const token = built.get(location.path);
        const { pointsToProperty } = location;
        if (pointsToProperty === undefined) return { occurrence, path, token };
        return { occurrence, path, token, pointsToProperty };
    });
}

function getTokenBuildFields(
    { path, mergedToken, resolved }: TokenToBuild,
    context: PermutationContext,
): TokenBuildFields {
    const deprecated = findDeprecation(mergedToken, context.merged);
    const shared = {
        type: resolved.type,
        deprecated,
        deprecatedByGroup: findDeprecatingGroup(context.merged, mergedToken, deprecated),
        definitions: getTokenDefinitions(path, mergedToken, context),
    };

    const { read } = resolved;
    if (!read.ok) return { ...shared, value: undefined, resolved: undefined, invalid: true };

    const resolvedValue = "resolved" in resolved ? resolved.resolved : undefined;
    return { ...shared, value: read.value, resolved: resolvedValue, invalid: undefined };
}

function getTokenDefinitions(
    path: string,
    { overridden, source, span }: MergedToken,
    context: PermutationContext,
): readonly Definition[] {
    const { tracker, sources } = context;
    if (!overridden) return tracker.getList(sources[source] as Source, span, path);

    const replaced = toDefinitions(overridden, path, context);
    return [...replaced, tracker.at(sources[source] as Source, span, path)];
}

function toDefinitions(
    locations: SourceSpan[],
    path: string,
    { tracker, sources }: PermutationContext,
): readonly Definition[] {
    const [first] = locations;
    if (!first) return NO_DEFINITIONS;
    if (locations.length === 1)
        return tracker.getList(sources[first.source] as Source, first.span, path);

    return locations.map(({ source, span }) => tracker.at(sources[source] as Source, span, path));
}

function findReusableToken(
    { path, mergedToken }: TokenToBuild,
    fields: TokenBuildFields,
    targets: readonly ReferenceWithTarget[],
    { reusable }: PermutationContext,
): Token | undefined {
    const candidates = reusable.tokens.get(path);
    return candidates?.find((token) => sameToken(token, mergedToken, fields, targets));
}

function createToken(
    mergedToken: MergedToken,
    fields: TokenBuildFields,
    reusable: ReusableIndex,
): Mutable<Token> {
    const token: Mutable<Token> = createTokenObject(toTokenFields(mergedToken, fields));
    addToIndex(reusable.tokens, mergedToken.path, token);
    return token;
}

function linkReferences(
    token: Mutable<Token>,
    { mergedToken, targets }: TokenToBuild,
    built: ReadonlyMap<string, Token>,
): void {
    if (targets.length === 0) return;

    const isBarePointer = mergedToken.value.type === "string";
    token.references = attachTargets(targets, built).map((target) =>
        createReference(token, target, { isBarePointer }),
    );
}

function reportDeprecated(
    path: string,
    targets: readonly ReferenceWithTarget[],
    { diagnostics, input }: PermutationContext,
): void {
    for (const { token, occurrence } of targets) {
        if (token?.deprecated === undefined) continue;

        const ref = toReferenceTarget(occurrence.reference);
        const reason = token.deprecated;
        const detail = typeof reason === "string" ? { ref, reason } : { ref };
        const extra = { span: occurrence.span, path, tags: ["deprecated" as const] };
        diagnostics.add(diagnostic("deprecated-reference", detail, extra), input);
    }
}

function buildGroups(
    tokens: ReadonlyMap<string, Token>,
    context: PermutationContext,
): Map<string, Group> {
    const { merged } = context;
    const built = new Map<string, Group>();

    const buildGroup = (path: string): Group | undefined => {
        const cached = built.get(path);
        if (cached) return cached;

        const mergedGroup = merged.groups.get(path);
        if (!mergedGroup) return undefined;

        const children = listChildren(path, tokens, buildGroup, merged);
        const extending =
            mergedGroup.extendsGroup === undefined
                ? undefined
                : buildGroup(mergedGroup.extendsGroup);
        const fields = getGroupBuildFields(mergedGroup, children, extending, context);
        const group =
            findReusableGroup(mergedGroup, fields, context) ??
            createGroup(mergedGroup, fields, tokens, context);

        built.set(path, group);
        return group;
    };

    buildGroup("");
    for (const path of merged.groups.keys()) buildGroup(path);
    return built;
}

function listChildren(
    parentPath: string,
    tokens: ReadonlyMap<string, Token>,
    buildGroup: (path: string) => Group | undefined,
    merged: Merged,
): (Token | Group)[] {
    const children: (Token | Group)[] = [];
    for (const path of merged.children.get(parentPath) ?? []) {
        const child = merged.tokens.has(path) ? tokens.get(path) : buildGroup(path);
        if (child !== undefined) children.push(child);
    }
    return children;
}

function findReusableGroup(
    mergedGroup: MergedGroup,
    { settings, deprecatedByGroup, definitions, children, extending }: GroupBuildFields,
    context: PermutationContext,
): Group | undefined {
    const candidates = context.reusable.groups.get(mergedGroup.path);
    const reused = candidates?.find((group) =>
        sameGroup(
            group,
            mergedGroup,
            settings,
            deprecatedByGroup,
            definitions,
            children,
            extending,
        ),
    );
    if (!reused) return undefined;

    if (mergedGroup.extends)
        context.tracker.recordMoves(reused.references, [mergedGroup.extends.span]);
    return reused;
}

function createGroup(
    mergedGroup: MergedGroup,
    { settings, deprecatedByGroup, definitions, children, extending }: GroupBuildFields,
    tokens: ReadonlyMap<string, Token>,
    context: PermutationContext,
): Group {
    const fields = toGroupFields(mergedGroup, settings, deprecatedByGroup, definitions);
    const group: Mutable<Group> = createGroupObject(fields);
    group.children = children;

    const rootToken = findRootToken(children);
    if (rootToken) group.rootToken = rootToken;
    if (extending) group.extends = extending;
    if (mergedGroup.extends) {
        const { reference, steps, span } = mergedGroup.extends;
        const occurrence = { reference, steps, span, property: [] };
        const [target] = attachTargets([locateTarget(occurrence, context.merged)], tokens);
        if (target) group.references = [createReference(group, target)];
    }

    addToIndex(context.reusable.groups, mergedGroup.path, group);
    return group;
}

function getGroupBuildFields(
    mergedGroup: MergedGroup,
    children: (Token | Group)[],
    extending: Group | undefined,
    context: PermutationContext,
): GroupBuildFields {
    const { merged } = context;
    const settings = getEffectiveSettings(merged, mergedGroup);
    const deprecatedByGroup = findDeprecatingGroup(
        merged,
        mergedGroup,
        settings.deprecated,
        settings.deprecatedBy,
    );
    const definitions = toDefinitions(mergedGroup.locations, mergedGroup.path, context);
    return { settings, deprecatedByGroup, definitions, children, extending };
}

function toPermutation(
    { input, label, sources, contexts, merged }: NormalisedPermutation,
    tokens: Map<string, Token>,
    groups: Map<string, Group>,
): Permutation {
    const topLevel = groups.get("") as Group;
    const groupsInOrder = [...merged.groups.keys()].flatMap((path) => groups.get(path) ?? []);

    return createPermutation(
        {
            input,
            label,
            sources,
            contexts,
            topLevel,
            children: topLevel.children,
            tokens: allTokens(topLevel.children),
            groups: groupsInOrder,
        },
        tokens,
        groups,
    );
}

class ValueResolver implements ReferenceResolver {
    readonly input: Input;
    readonly merged: Merged;
    readonly readValue: ValueReader;
    #diagnostics: DiagnosticCollector;
    #missing: MissingRecorder;

    #results = new Map<string, ResolveResult | typeof RESOLVING>();
    #resolveStack: { path: string; span: Span }[] = [];

    constructor(
        { input, merged }: NormalisedPermutation,
        readValue: ValueReader,
        diagnostics: DiagnosticCollector,
        missing: MissingRecorder,
    ) {
        this.input = input;
        this.merged = merged;
        this.readValue = readValue;
        this.#diagnostics = diagnostics;
        this.#missing = missing;
    }

    resolve(token: MergedToken): ResolveResult {
        const cached = this.#results.get(token.path);
        if (cached === RESOLVING) {
            this.#reportLoop(token.path);
            return "untyped";
        }
        if (cached) return cached;

        this.#results.set(token.path, RESOLVING);
        const result = this.#resolveUncached(token);
        this.#results.set(token.path, result);
        return result;
    }

    #resolveUncached(token: MergedToken): ResolveResult {
        const declaredType = this.#findDeclaredType(token);
        if (declaredType === "untyped") return "untyped";

        const alias = createAliasOccurrence(token);
        if (alias) return this.#resolveAlias(token, alias, declaredType);

        if (declaredType === undefined) return "untyped";
        return this.#readAndResolve(token, declaredType);
    }

    #findDeclaredType(token: MergedToken): TokenType | "untyped" | undefined {
        if (token.type === undefined && token.reference) return undefined;

        const type = getInheritedProperty(token, this.merged, "type");
        if (type === "invalid") return "untyped";
        if (type === undefined) {
            this.report("missing-type", {}, token.path, token.nameSpan);
            return "untyped";
        }
        return type;
    }

    #resolveAlias(
        token: MergedToken,
        alias: Occurrence,
        declaredType: TokenType | undefined,
    ): ResolveResult {
        const target = this.#followAlias(token, alias);

        if (target.kind === "unreachable") {
            this.reportUnreachable(alias, token.path, alias.span);
            return this.#readWithFallbackType(token, declaredType);
        }

        if (target.kind === "part") {
            const type = declaredType ?? this.#findGroupType(token);
            if (type === undefined) {
                this.report("missing-type", {}, token.path, token.nameSpan);
                return "untyped";
            }
            return this.#readAndResolve(token, type);
        }

        const targetValue = target.value;
        if (targetValue === undefined || targetValue === "untyped") {
            return this.#readWithFallbackType(token, declaredType);
        }

        const type = declaredType ?? targetValue.type;
        if (!("resolved" in targetValue)) return this.#readWithoutResolving(token, type);
        return this.#readAndResolve(token, type);
    }

    #followAlias(token: MergedToken, alias: Occurrence): AliasTarget {
        const { reference } = alias;
        if (reference.syntax === "curly-brace") {
            const value = this.resolveDependency(reference.path, token.path, alias.span);
            if (value === undefined) return { kind: "unreachable" };
            return { kind: "token", value };
        }

        const target = followReference(alias, this.merged);
        if (target.kind === "token") {
            const value = this.resolveDependency(target.path, token.path, alias.span);
            return { kind: "token", value };
        }
        if (target.kind === "part") return { kind: "part" };
        return { kind: "unreachable" };
    }

    resolveDependency(path: string, from: string, span: Span): ResolveResult | undefined {
        const token = this.merged.tokens.get(path);
        if (!token) return undefined;

        this.#resolveStack.push({ path: from, span });
        const result = this.resolve(token);
        this.#resolveStack.pop();
        return result;
    }

    #readAndResolve(token: MergedToken, type: TokenType): ResolveResult {
        const {
            result: read,
            references,
            deferredReads,
        } = this.readValue.read(token, type, this.input);
        const unresolved = { type, read, references };
        if (!read.ok) return unresolved;
        if (references.length === 0) return { ...unresolved, resolved: read.value };

        const value = resolveValue(this, token, read.value, references, deferredReads);
        if (value === UNRESOLVED) return unresolved;
        return { ...unresolved, resolved: value };
    }

    #readWithFallbackType(token: MergedToken, declaredType: TokenType | undefined): ResolveResult {
        const type = declaredType ?? this.#findGroupType(token);
        if (type === undefined) return "untyped";
        return this.#readWithoutResolving(token, type);
    }

    #readWithoutResolving(token: MergedToken, type: TokenType): ResolveResult {
        const { result: read, references } = this.readValue.read(token, type, this.input);
        return { type, read, references };
    }

    #findGroupType(token: MergedToken): TokenType | undefined {
        return toValidType(getInheritedProperty(token, this.merged, "type"));
    }

    #reportLoop(path: string): void {
        const start = this.#resolveStack.findIndex((frame) => frame.path === path);
        const loop = this.#resolveStack.slice(start);
        const [first, ...rest] = loop;
        if (!first) return;

        const chain = [...loop.map((frame) => frame.path), path];
        const relatedInformation = rest.map((frame) => ({
            message: relatedMessages.partOfTheLoop,
            span: frame.span,
            path: frame.path,
        }));
        this.report("circular-reference", { chain }, first.path, first.span, {
            relatedInformation,
        });
    }

    reportUnresolved(lookup: ReferenceLookup, from: string, span: Span): void {
        const ref = toReferenceTarget(lookup.reference);
        const targetKind = followReference(lookup, this.merged).kind;

        if (targetKind === "group") {
            this.report("not-a-token", { ref }, from, span);
            return;
        }
        if (targetKind === "stops-at-token") {
            this.report("not-a-value", { ref, suggestion: toValuePointer(ref) }, from, span);
            return;
        }
        this.#missing.record(lookup.reference, from, span);
    }

    reportUnreachable(lookup: ReferenceLookup, from: string, span: Span): void {
        const { reference } = lookup;
        if (reference.syntax === "json-pointer") {
            const malformed = checkMalformedPointer(reference.pointer, this.merged, "value");
            if (malformed) {
                this.report("malformed-pointer", malformed, from, span);
                return;
            }
        }
        this.reportUnresolved(lookup, from, span);
    }

    report<K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        path: string,
        span: Span,
        extra: Omit<DiagnosticExtra, "span" | "path"> = {},
    ): void {
        this.#diagnostics.add(diagnostic(kind, detail, { span, path, ...extra }), this.input);
    }
}

function indexReusable(previous: DesignTokens | undefined): ReusableIndex {
    const index: ReusableIndex = { tokens: new Map(), groups: new Map() };
    for (const permutation of previous?.permutations ?? []) {
        for (const token of permutation.tokens) addToIndex(index.tokens, token.path, token);
        for (const group of permutation.groups) addToIndex(index.groups, group.path, group);
    }
    return index;
}

function addToIndex<T>(index: Map<string, T[]>, path: string, item: T): void {
    const list = index.get(path);
    if (!list) index.set(path, [item]);
    else if (!list.includes(item)) list.push(item);
}

function findRootToken(children: readonly (Token | Group)[]): Token | undefined {
    return children.find(
        (child): child is Token =>
            child.kind === "token" && tokenPath.getName(child.path) === "$root",
    );
}

function locateTarget(occurrence: Occurrence, merged: Merged): TargetLocation {
    const { reference } = occurrence;
    if (reference.syntax === "curly-brace") {
        return { occurrence, path: reference.path, isToken: true };
    }

    const target = followReference(occurrence, merged);
    if (target.kind === "nothing") {
        return { occurrence, path: getReferencePath(reference), isToken: false };
    }
    if (target.kind === "token") return { occurrence, path: target.path, isToken: true };
    if (target.kind === "group" || target.kind === "stops-at-token") {
        return { occurrence, path: target.path, isToken: false };
    }

    const pointsToProperty = getAtPath(target.token.originalValue, target.inside)?.property;
    return { occurrence, path: target.path, isToken: true, pointsToProperty };
}

function toGroupFields(
    group: MergedGroup,
    settings: EffectiveSettings,
    deprecatedByGroup: string | undefined,
    definitions: readonly Definition[],
): Parameters<typeof createGroupObject>[0] {
    const { path, inherited: inheritedFrom } = group;
    const own = pickPublicProperties(group);
    return {
        path,
        ...pickPublicProperties(settings),
        ...(deprecatedByGroup !== undefined && { deprecatedByGroup }),
        definitions,
        extensionDefinitions: getExtensionDefinitions(group, definitions),
        children: [],
        references: NO_REFERENCES,
        ...(inheritedFrom && { inherited: inheritedFrom }),
        ...(Object.keys(own).length > 0 && { original: own }),
    };
}

function getExtensionDefinitions(
    { extensionLocations, locations }: MergedGroup,
    definitions: readonly Definition[],
): Readonly<Record<string, Definition>> {
    if (!extensionLocations) return NO_EXTENSION_DEFINITIONS;

    const byKey: Record<string, Definition> = {};
    for (const [key, { source }] of Object.entries(extensionLocations)) {
        locations.forEach((location, index) => {
            const definition = definitions[index];
            if (location.source === source && definition) byKey[key] = definition;
        });
    }
    return Object.freeze(byKey);
}

function pickPublicProperties<Deprecated extends Properties["deprecated"]>({
    type: declaredType,
    description,
    deprecated,
    extensions,
}: Omit<Properties, "deprecated"> & { deprecated?: Deprecated }): Omit<
    OriginalProperties,
    "deprecated"
> & {
    deprecated?: Deprecated;
} {
    const type = toValidType(declaredType);
    return {
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(extensions && { extensions }),
    };
}

function toTokenFields(
    token: MergedToken,
    fields: TokenBuildFields,
): Parameters<typeof createTokenObject>[0] {
    const original = token.isGenerated
        ? undefined
        : {
              value: token.originalValue,
              ...pickPublicProperties({ type: token.type, deprecated: token.deprecated }),
          };

    return {
        path: token.path,
        type: fields.type,
        references: NO_REFERENCES,
        definitions: fields.definitions,
        value: fields.value,
        resolved: fields.resolved,
        invalid: fields.invalid,
        description: token.description,
        deprecated: fields.deprecated,
        deprecatedByGroup: fields.deprecatedByGroup,
        extensions: token.extensions,
        original,
        generated: token.generated,
        inherited: token.inherited,
    } as Parameters<typeof createTokenObject>[0];
}
