import { relatedMessages } from "../../error-messages.js";
import type { DesignTokens } from "../../model/design-tokens.js";
import type { DiagnosticDetailByKind, DiagnosticKind } from "../../model/diagnostic.js";
import { type Group, createGroupObject, allTokens } from "../../model/group.js";
import { type Input, type Permutation, createPermutation } from "../../model/permutation.js";
import type { JsonPath, Span } from "../../model/location.js";
import type { ParseResult } from "../../model/parse.js";
import {
    type Definition,
    type LocalGroup,
    NO_EXTENSION_DEFINITIONS,
    NO_DEFINITIONS,
} from "../../model/definition.js";
import type { Source } from "../../model/source.js";
import { type InheritedFrom, type Token, createTokenObject } from "../../model/token.js";
import type { TokenType } from "../../model/value.js";
import { tokenPath } from "../../path.js";
import { getReferencePath, toReferenceTarget } from "../../values/references.js";
import type { Mutable } from "../types.js";
import {
    type DiagnosticExtra,
    diagnostic,
    type DiagnosticCollector,
} from "../diagnostics/diagnostics.js";
import {
    type EffectiveSettings,
    getEffectiveSettings,
    findDeprecatedFrom,
    findDeprecation,
    findGroupDescriptionFrom,
    findGroupTypeFrom,
    findTokenType,
} from "../merge/inherit.js";
import { NO_REFERENCES, type ReferenceWithTarget, createReference } from "../../model/reference.js";
import type { DefinitionTracker } from "./definition-tracker.js";
import { checkMalformedPointer } from "../json/malformed-pointer.js";
import type { Merged, MergedGroup, MergedToken, SourceSpan } from "../merge/merge.js";
import type { MissingRecorder, MissingReferences } from "./missing.js";
import type { MergedPermutation } from "../merge/merge-permutations.js";
import { type Occurrence, createAliasOccurrence } from "./occurrence.js";
import type { LocatedReference, ValueReader } from "./value-reader.js";
import {
    type ReferenceLookup,
    followReference,
    getAtPath,
    toValuePointer,
} from "../merge/target.js";
import { type ResolveContext, UNRESOLVED, resolveValue } from "./resolve-value.js";
import { type GroupBuildFields, type TokenBuildFields, sameGroup, sameToken } from "./reuse.js";
import { type Properties, toValidType } from "../merge/walk.js";

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
    typeFrom: InheritedFrom | undefined;
}

type ResolveResult = Resolved | "untyped";

interface DeclaredType {
    type: TokenType;
    typeFrom: InheritedFrom | undefined;
}

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

interface NewToken {
    token: Mutable<Token>;
    tokenToBuild: TokenToBuild;
}

type AliasTarget =
    | { kind: "token"; path: string; value: ResolveResult | undefined }
    | { kind: "part" }
    | { kind: "unreachable" };

const RESOLVING = Symbol("resolving");

const NONE: readonly never[] = [];

export function buildPermutations(
    permutations: MergedPermutation[],
    { previous, ...rest }: Omit<Context, "reusable"> & { previous: DesignTokens | undefined },
): Permutation[] {
    const context = { ...rest, reusable: indexReusable(previous) };
    return permutations.map((permutation) => buildPermutation(permutation, context));
}

function buildPermutation(permutation: MergedPermutation, context: Context): Permutation {
    const { input, merged, sources, unreadSources } = permutation;
    const { readValue, diagnostics, tracker, reusable } = context;
    const missing = context.missing.createRecorder(input, merged.tokens, unreadSources);
    const tokenValues = new TokenValues(permutation, readValue, diagnostics, missing);
    const shared = { input, merged, sources, tracker, diagnostics, reusable };

    const tokensToBuild = orderTokens(merged, tokenValues);
    const tokens = buildTokens(tokensToBuild, shared);
    const groups = buildGroups(tokens, shared);
    missing.flush();

    return toPermutation(permutation, tokens, groups);
}

function orderTokens(merged: Merged, tokenValues: TokenValues): TokenToBuild[] {
    const tokensToBuild: TokenToBuild[] = [];
    const visits = new Map<string, "visiting" | "done">();

    const visit = (path: string) => {
        if (visits.has(path)) return;

        const mergedToken = merged.tokens.get(path);
        if (!mergedToken) return;

        visits.set(path, "visiting");
        const resolved = tokenValues.resolve(mergedToken);
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
        typeFrom: resolved.typeFrom,
        deprecated,
        deprecatedFrom: findDeprecatedFrom(context.merged, mergedToken, deprecated),
        definitions: getTokenDefinitions(path, mergedToken, context),
    };

    const { read } = resolved;
    if (!read.ok)
        return { ...shared, parsedValue: undefined, resolvedValue: undefined, invalid: true };

    const resolvedValue = "resolved" in resolved ? resolved.resolved : undefined;
    return { ...shared, parsedValue: read.value, resolvedValue: resolvedValue, invalid: undefined };
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
    fields: GroupBuildFields,
    context: PermutationContext,
): Group | undefined {
    const candidates = context.reusable.groups.get(mergedGroup.path);
    const reused = candidates?.find((group) => sameGroup(group, mergedGroup, fields));
    if (!reused) return undefined;

    if (mergedGroup.extends)
        context.tracker.recordMoves(reused.references, [mergedGroup.extends.span]);
    return reused;
}

function createGroup(
    mergedGroup: MergedGroup,
    fields: GroupBuildFields,
    tokens: ReadonlyMap<string, Token>,
    context: PermutationContext,
): Group {
    const { children, extending } = fields;
    const group: Mutable<Group> = createGroupObject(toGroupFields(mergedGroup, fields));
    group.children = children;

    const rootToken = findRootToken(children);
    group.rootToken = rootToken;
    group.extends = extending;
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
    const deprecatedFrom = findDeprecatedFrom(
        merged,
        mergedGroup,
        settings.deprecated,
        settings.deprecatedBy,
    );
    const definitions = toDefinitions(mergedGroup.locations, mergedGroup.path, context);
    return {
        settings,
        typeFrom: findGroupTypeFrom(merged, mergedGroup),
        descriptionFrom: findGroupDescriptionFrom(merged, mergedGroup),
        deprecatedFrom,
        definitions,
        extensionDefinitions: getExtensionDefinitions(settings, context),
        children,
        extending,
    };
}

function toPermutation(
    { input, label, sources, contexts, merged }: MergedPermutation,
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

class TokenValues implements ResolveContext {
    readonly input: Input;
    readonly merged: Merged;
    readonly readValue: ValueReader;
    #diagnostics: DiagnosticCollector;
    #missing: MissingRecorder;

    #results = new Map<string, ResolveResult | typeof RESOLVING>();
    #resolveStack: { path: string; span: Span }[] = [];

    constructor(
        { input, merged }: MergedPermutation,
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
        const declared = this.#findDeclaredType(token);
        if (declared === "untyped") return "untyped";

        const alias = createAliasOccurrence(token);
        if (alias) return this.#resolveAlias(token, alias, declared);

        if (declared === undefined) return "untyped";
        return this.#readAndResolve(token, declared.type, declared.typeFrom);
    }

    #findDeclaredType(token: MergedToken): DeclaredType | "untyped" | undefined {
        if (token.type === undefined && token.reference) return undefined;

        const { type, typeFrom } = findTokenType(this.merged, token);
        if (type === "invalid") return "untyped";
        if (type === undefined) {
            this.report("missing-type", {}, token.path, token.nameSpan);
            return "untyped";
        }
        return { type, typeFrom };
    }

    #resolveAlias(
        token: MergedToken,
        alias: Occurrence,
        declared: DeclaredType | undefined,
    ): ResolveResult {
        const target = this.#followAlias(token, alias);

        if (target.kind === "unreachable") {
            this.reportUnreachable(alias, token.path, alias.span);
            return this.#readWithFallbackType(token, declared);
        }

        if (target.kind === "part") {
            const found = declared ?? this.#findGroupType(token);
            if (found === undefined) {
                this.report("missing-type", {}, token.path, token.nameSpan);
                return "untyped";
            }
            return this.#readAndResolve(token, found.type, found.typeFrom);
        }

        const targetValue = target.value;
        if (targetValue === undefined || targetValue === "untyped") {
            return this.#readWithFallbackType(token, declared);
        }

        const type = declared?.type ?? targetValue.type;
        const typeFrom: InheritedFrom | undefined =
            declared === undefined ? { path: target.path, via: "reference" } : undefined;
        if (!("resolved" in targetValue)) return this.#readWithoutResolving(token, type, typeFrom);
        return this.#readAndResolve(token, type, typeFrom);
    }

    #followAlias(token: MergedToken, alias: Occurrence): AliasTarget {
        const { reference } = alias;
        if (reference.syntax === "curly-brace") {
            const value = this.resolveDependency(reference.path, token.path, alias.span);
            if (value === undefined) return { kind: "unreachable" };
            return { kind: "token", path: reference.path, value };
        }

        const target = followReference(alias, this.merged);
        if (target.kind === "token") {
            const value = this.resolveDependency(target.path, token.path, alias.span);
            return { kind: "token", path: target.path, value };
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

    #readAndResolve(
        token: MergedToken,
        type: TokenType,
        typeFrom: InheritedFrom | undefined,
    ): ResolveResult {
        const {
            result: read,
            references,
            deferredReads,
        } = this.readValue.read(token, type, this.input);
        const unresolved = { type, read, references, typeFrom };
        if (!read.ok) return unresolved;
        if (references.length === 0) return { ...unresolved, resolved: read.value };

        const value = resolveValue(this, token, read.value, references, deferredReads);
        if (value === UNRESOLVED) return unresolved;
        return { ...unresolved, resolved: value };
    }

    #readWithFallbackType(token: MergedToken, declared: DeclaredType | undefined): ResolveResult {
        const found = declared ?? this.#findGroupType(token);
        if (found === undefined) return "untyped";
        return this.#readWithoutResolving(token, found.type, found.typeFrom);
    }

    #readWithoutResolving(
        token: MergedToken,
        type: TokenType,
        typeFrom: InheritedFrom | undefined,
    ): ResolveResult {
        const { result: read, references } = this.readValue.read(token, type, this.input);
        return { type, read, references, typeFrom };
    }

    #findGroupType(token: MergedToken): DeclaredType | undefined {
        const { type, typeFrom } = findTokenType(this.merged, token);
        const valid = toValidType(type);
        return valid === undefined ? undefined : { type: valid, typeFrom };
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
    {
        settings,
        typeFrom,
        descriptionFrom,
        deprecatedFrom,
        definitions,
        extensionDefinitions,
    }: GroupBuildFields,
): Parameters<typeof createGroupObject>[0] {
    const { path, extendedFrom } = group;
    const local = getLocalGroup(group);
    return {
        path,
        ...pickPublicProperties(settings),
        typeFrom,
        descriptionFrom,
        deprecatedFrom,
        definitions,
        extensionDefinitions,
        children: [],
        references: NO_REFERENCES,
        extendedFrom,
        local: Object.keys(local).length > 0 ? local : undefined,
    };
}

function getLocalGroup(group: MergedGroup): LocalGroup {
    const extended = group.extends && getReferencePath(group.extends.reference);
    return {
        ...pickPublicProperties(group),
        ...(extended !== undefined && { extends: extended }),
    };
}

function getExtensionDefinitions(
    { extensionLocations }: EffectiveSettings,
    { merged, tracker, sources }: PermutationContext,
): Readonly<Record<string, Definition>> {
    if (!extensionLocations) return NO_EXTENSION_DEFINITIONS;

    const byKey: Record<string, Definition> = {};
    for (const [key, { source, group }] of Object.entries(extensionLocations)) {
        const writer = merged.groups.get(group);
        const location = writer?.locations.findLast((each) => each.source === source);
        if (writer && location) {
            byKey[key] = tracker.at(sources[source] as Source, location.span, writer.path);
        }
    }
    return Object.freeze(byKey);
}

function pickPublicProperties<Deprecated extends Properties["deprecated"]>({
    type: declaredType,
    description,
    deprecated,
    extensions,
}: Omit<Properties, "deprecated"> & { deprecated?: Deprecated }): Omit<
    LocalGroup,
    "deprecated" | "extends"
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
    return {
        path: token.path,
        type: fields.type,
        typeFrom: fields.typeFrom,
        references: NO_REFERENCES,
        definitions: fields.definitions,
        parsedValue: fields.parsedValue,
        resolvedValue: fields.resolvedValue,
        invalid: fields.invalid,
        description: token.description,
        deprecated: fields.deprecated,
        deprecatedFrom: fields.deprecatedFrom,
        extensions: token.extensions,
        generatedFrom: token.generatedFrom,
        extendedFrom: token.extendedFrom,
    } as Parameters<typeof createTokenObject>[0];
}
