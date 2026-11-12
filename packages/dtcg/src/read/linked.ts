import { parse } from "jsonc-parser";
import type {
    Change,
    DefinitionInPermutations,
    DesignTokens,
    Diagnostic,
    Group,
    Input,
    JsonPath,
    JsonValue,
    Move,
    Part,
    Permutation,
    Definition,
    Reference,
    ReferenceInPermutations,
    ReferenceOptions,
    ResolverContext,
    ResolverModifier,
    Source,
    Span,
    Token,
} from "../model.js";
import { createDiagnosticFilter } from "../lookup/diagnostics.js";
import { Changes, diffGroup, pairByPath, diffToken } from "../lookup/changes-since.js";
import { SPAN_OF, getSpan } from "../lookup/editor.js";
import { findJsonPath } from "../lookup/json-path.js";
import { buildParts } from "../lookup/parts.js";
import { PermutationError, findPermutation, getOnlyPermutation } from "../lookup/permutation.js";
import { isEquivalentValue } from "../values/same-value.js";
import { referenceIndex } from "../lookup/references.js";
import { tokenPath } from "../path.js";
import { makePermutations } from "./make-permutations.js";
import { getReferenceSpan, toReferenceInPermutations } from "./reference.js";
import { samePropertyPath } from "./same-object.js";
import { type KnownFiles, createKnownFiles, withChanges } from "./known-files.js";

export const NO_REFERENCES: readonly Reference[] = Object.freeze([]);
export const NO_DEFINITIONS: readonly Definition[] = Object.freeze([]);
export const NO_EXTENSION_DEFINITIONS: Readonly<Record<string, Definition>> = Object.freeze({});

interface Merged {
    reference: Reference;
    ownerPaths: Set<string>;
    inheritedPaths: Set<string>;
    permutations: Permutation[];
}

const UNCOMPUTED = Symbol("not yet worked out");

type TokenFields = Omit<
    Token,
    "kind" | "getReferenceAt" | "aliasChain" | "winningDefinition" | "parts"
>;

type GroupFields = Omit<Group, "kind" | "childTokens" | "tokens">;

class TokenObject {
    #aliasChain: readonly Token[] | undefined;
    #parts: Part | undefined | typeof UNCOMPUTED = UNCOMPUTED;

    constructor(fields: TokenFields) {
        const self = this as unknown as Record<string, unknown>;
        self.path = fields.path;
        self.type = fields.type;
        self.references = fields.references;
        self.definitions = fields.definitions;
        if (fields.value !== undefined) self.value = fields.value;
        if (fields.resolved !== undefined) self.resolved = fields.resolved;
        if (fields.invalid) self.invalid = fields.invalid;
        if (fields.description !== undefined) self.description = fields.description;
        if (fields.deprecated !== undefined) self.deprecated = fields.deprecated;
        if (fields.deprecatedByGroup !== undefined)
            self.deprecatedByGroup = fields.deprecatedByGroup;
        if (fields.extensions) self.extensions = fields.extensions;
        if (fields.original) self.original = fields.original;
        if (fields.generated) self.generated = fields.generated;
        if (fields.inherited) self.inherited = fields.inherited;
    }

    getReferenceAt(property: JsonPath = []): Reference | undefined {
        return (this as unknown as Token).references.find((each) =>
            samePropertyPath(each.property, property),
        );
    }

    get aliasChain(): readonly Token[] {
        this.#aliasChain ??= followAliasChain(this as unknown as Token);
        return this.#aliasChain;
    }

    get winningDefinition(): Definition {
        const { definitions } = this as unknown as Token;
        return definitions[definitions.length - 1] as Definition;
    }

    get parts(): Part | undefined {
        if (this.#parts === UNCOMPUTED) this.#parts = buildParts(this as unknown as Token);
        return this.#parts;
    }
}
Object.defineProperty(TokenObject.prototype, "kind", { value: "token" });

class GroupObject {
    #childTokens: readonly Token[] | undefined;
    #tokens: readonly Token[] | undefined;

    constructor(fields: GroupFields) {
        Object.assign(this, fields);
    }

    get childTokens(): readonly Token[] {
        this.#childTokens ??= (this as unknown as Group).children.filter(
            (child): child is Token => child.kind === "token",
        );
        return this.#childTokens;
    }

    get tokens(): readonly Token[] {
        this.#tokens ??= allTokens((this as unknown as Group).children);
        return this.#tokens;
    }

    toJSON() {
        const group = this as unknown as Group;
        return {
            ...group,
            extends: undefined,
            rootToken: undefined,
            children: paths(group.children),
        };
    }
}
Object.defineProperty(GroupObject.prototype, "kind", { value: "group" });

function followAliasChain(token: Token): Token[] {
    const chain: Token[] = [];
    for (let current: Token | undefined = token; current;) {
        if (chain.includes(current)) break;
        chain.push(current);
        current = current.getReferenceAt()?.pointsToWholeToken;
    }
    return chain;
}

export function allTokens(children: readonly (Token | Group)[], found: Token[] = []): Token[] {
    for (const child of children) {
        if (child.kind === "token") found.push(child);
        else allTokens(child.children, found);
    }
    return found;
}

type PermutationFields = Omit<Permutation, keyof PermutationObject>;

class PermutationObject {
    readonly #tokens: ReadonlyMap<string, Token>;
    readonly #groups: ReadonlyMap<string, Group>;
    #designTokens: DesignTokens | undefined;

    constructor(
        fields: PermutationFields,
        tokens: ReadonlyMap<string, Token>,
        groups: ReadonlyMap<string, Group>,
    ) {
        Object.assign(this, fields);
        this.#tokens = tokens;
        this.#groups = groups;
    }

    get isDefault(): boolean {
        return this.#self.contexts.every((context) => context.isDefault);
    }

    getToken(path: string): Token | undefined {
        return this.#tokens.get(path);
    }

    getGroup(path: string): Group | undefined {
        return this.#groups.get(path);
    }

    getTokenOrGroup(path: string): Token | Group | undefined {
        return this.#tokens.get(path) ?? this.#groups.get(path);
    }

    getReferencesTo(path: string, { chained = false }: ReferenceOptions = {}): Reference[] {
        const { position, byPath } = referenceIndex(this.#self);
        const findReferences = (each: string, isToken: boolean): Reference[] => {
            if (isToken) return byPath.get(each) ?? [];
            return [...byPath].flatMap(([named, references]) =>
                tokenPath.contains(each, named) ? references : [],
            );
        };
        const first = findReferences(path, this.getToken(path) !== undefined);
        const found = new Set<Reference>(first);
        const seen = new Set([path]);
        const waiting = chained ? [first] : [];
        for (const references of waiting) {
            for (const reference of references) {
                found.add(reference);
                const { owner } = reference;
                if (seen.has(owner.path)) continue;
                seen.add(owner.path);
                waiting.push(findReferences(owner.path, owner.kind === "token"));
            }
        }
        return [...found].sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0));
    }

    getDependents(path: string, options?: ReferenceOptions): (Token | Group)[] {
        return [...new Set(this.getReferencesTo(path, options).map(({ owner }) => owner))];
    }

    getDependencies(path: string, { chained = false }: ReferenceOptions = {}): (Token | Group)[] {
        const start = this.getTokenOrGroup(path);
        if (!start) return [];
        const found = new Set<Token | Group>();
        const followed = new Set<Token | Group>([start]);
        const waiting: (Token | Group)[] = [start];
        for (const each of waiting) {
            for (const { pointsToPath } of each.references) {
                const next =
                    pointsToPath === undefined ? undefined : this.getTokenOrGroup(pointsToPath);
                if (!next) continue;
                found.add(next);
                if (!chained || followed.has(next)) continue;
                followed.add(next);
                waiting.push(next);
            }
        }
        return [...found];
    }

    getTokensDifferentFrom(other: Permutation): Token[] {
        return this.#self.tokens.filter((token) => {
            const otherToken = other.getToken(token.path);
            if (otherToken === token) return false;
            if (otherToken === undefined || otherToken.type !== token.type) return true;
            if (token.resolved === undefined || otherToken.resolved === undefined)
                return token.resolved !== otherToken.resolved;
            return !isEquivalentValue(token.type, token.resolved, otherToken.resolved);
        });
    }

    getDiagnostics(path: string): Diagnostic[] {
        const tokens = this.#designTokens as DesignTokens;
        const permutation = this.#self;
        const about = createDiagnosticFilter(tokens, path, [permutation]);
        return tokens.diagnostics.filter(
            (found) => found.permutations.includes(permutation) && about(found),
        );
    }

    toJSON() {
        const permutation = this.#self;
        const sources = permutation.sources.map(SourceObject.positionOf);
        return {
            ...permutation,
            contexts: undefined,
            sources,
            children: paths(permutation.children),
        };
    }

    get #self(): Permutation {
        return this as unknown as Permutation;
    }

    static setOwner(permutation: PermutationObject, tokens: DesignTokens): void {
        permutation.#designTokens = tokens;
    }
}

const modifierShared = {
    toJSON(this: ResolverModifier) {
        const contexts = this.contexts.map(({ name, sources, span }) => ({ name, sources, span }));
        return { ...this, contexts };
    },
};

const contextShared = {
    toJSON(this: ResolverContext) {
        return { modifier: this.modifier.name, name: this.name };
    },
};

interface ReadState {
    texts: Readonly<Record<string, string>>;
    newSpans: ReadonlyMap<Definition | Reference, Span>;
    known: KnownFiles;
    reread(known: KnownFiles, previous: DesignTokens): DesignTokens;
}

type DesignTokensFields = Omit<DesignTokens, keyof DesignTokensObject>;

class DesignTokensObject {
    readonly #state: ReadState;

    constructor(fields: DesignTokensFields, state: ReadState) {
        Object.assign(this, fields);
        this.#state = state;
    }

    getReferencesTo(path: string): ReferenceInPermutations[] {
        const tokens = this.#self;
        const merged = new Map<Span, Merged[]>();
        for (const permutation of tokens.permutations) {
            for (const reference of permutation.getReferencesTo(path)) {
                const span = getSpan(tokens, reference);
                let atSpan = merged.get(span);
                if (!atSpan) merged.set(span, (atSpan = []));
                let entry = atSpan.find((each) =>
                    samePropertyPath(each.reference.property, reference.property ?? []),
                );
                if (!entry) {
                    entry = {
                        reference,
                        ownerPaths: new Set(),
                        inheritedPaths: new Set(),
                        permutations: [],
                    };
                    atSpan.push(entry);
                }
                if (!entry.permutations.includes(permutation)) entry.permutations.push(permutation);
                const { owner } = reference;
                (owner.inherited ? entry.inheritedPaths : entry.ownerPaths).add(owner.path);
            }
        }
        return [...merged].flatMap(([span, entries]) =>
            entries.map(({ reference, ownerPaths, inheritedPaths, permutations }) =>
                toReferenceInPermutations(
                    reference,
                    [...new Set([...ownerPaths, ...inheritedPaths])],
                    makePermutations(permutations, tokens.permutations),
                    span,
                    () => findJsonPath(tokens, span),
                ),
            ),
        );
    }

    getDefinitions(path: string): DefinitionInPermutations[] {
        const tokens = this.#self;
        const found = new Map<
            Span,
            { sources: Source[]; permutations: Permutation[]; first: Definition }
        >();
        for (const permutation of tokens.permutations) {
            const definitions = [
                ...(permutation.getToken(path)?.definitions ?? []),
                ...(permutation.getGroup(path)?.definitions ?? []),
            ];
            for (const definition of definitions) {
                const { source } = definition;
                const span = getSpan(tokens, definition);
                const known = found.get(span);
                if (!known) {
                    found.set(span, {
                        sources: [source],
                        permutations: [permutation],
                        first: definition,
                    });
                    continue;
                }
                if (!known.sources.includes(source)) known.sources.push(source);
                known.permutations.push(permutation);
            }
        }
        return [...found].map(([span, { sources, permutations, first }]) => ({
            span,
            get jsonPath() {
                return findJsonPath(tokens, span);
            },
            get json() {
                return first.json;
            },
            sources,
            permutations: makePermutations(permutations, tokens.permutations),
            winningPermutations: makePermutations(
                permutations.filter((permutation) => {
                    const winner = permutation.getToken(path)?.winningDefinition;
                    return winner !== undefined && getSpan(tokens, winner) === span;
                }),
                tokens.permutations,
            ),
        }));
    }

    getPermutation(input: Input = {}) {
        const found = findPermutation(this.#self, input);
        if ("reason" in found) throw new PermutationError(found);
        return found;
    }

    getPermutationsReading(file: string) {
        const { permutations, entryFile } = this.#self;
        if (file === entryFile) return permutations;
        return permutations.select(({ sources }) => sources.some((source) => source.file === file));
    }

    getToken(path: string) {
        return getOnlyPermutation(this.#self, "getToken()").getToken(path);
    }

    getGroup(path: string) {
        return getOnlyPermutation(this.#self, "getGroup()").getGroup(path);
    }

    getDependents(path: string, options?: ReferenceOptions) {
        return getOnlyPermutation(this.#self, "getDependents()").getDependents(path, options);
    }

    getDependencies(path: string, options?: ReferenceOptions) {
        return getOnlyPermutation(this.#self, "getDependencies()").getDependencies(path, options);
    }

    get tokens() {
        return getOnlyPermutation(this.#self, "tokens").tokens;
    }

    get groups() {
        return getOnlyPermutation(this.#self, "groups").groups;
    }

    get children() {
        return getOnlyPermutation(this.#self, "children").children;
    }

    get topLevel() {
        return getOnlyPermutation(this.#self, "topLevel").topLevel;
    }

    getTokenOrGroup(path: string) {
        return getOnlyPermutation(this.#self, "getTokenOrGroup()").getTokenOrGroup(path);
    }

    getTokenPaths() {
        return allPaths(this.#self, "tokens");
    }

    getGroupPaths() {
        return allPaths(this.#self, "groups");
    }

    toJSON() {
        const tokens = this.#self;
        return { ...tokens, permutations: [...tokens.permutations] };
    }

    getDiagnostics(path: string) {
        const tokens = this.#self;
        return tokens.diagnostics.filter(createDiagnosticFilter(tokens, path, tokens.permutations));
    }

    getChangesSince(before: DesignTokens, options?: { moves?: Move[] }): Change[] {
        const moves = options?.moves ?? [];
        const changes = new Changes();
        for (const now of this.#self.permutations) {
            const was = findPermutation(before, now.input);
            if ("reason" in was) continue;
            for (const pair of pairByPath(was.groups, now.groups, moves)) {
                if (pair.before !== pair.after) changes.add(diffGroup(pair, moves), now);
            }
            for (const pair of pairByPath(was.tokens, now.tokens, moves)) {
                if (pair.before !== pair.after) changes.add(diffToken(pair, moves), now);
            }
        }
        return changes.list(this.#self.permutations);
    }

    getText(file: string): string | undefined {
        return this.#state.texts[file];
    }

    reread(changed: Readonly<Record<string, string | null>>) {
        const { known, reread } = this.#state;
        return reread(withChanges(known, changed), this.#self);
    }

    rereadAll(files: Readonly<Record<string, string>>) {
        const { texts, reread } = this.#state;
        const unchanged =
            Object.keys(texts).every((file) => file in files) &&
            Object.entries(files).every(([file, text]) => texts[file] === text);
        if (unchanged) return this.#self;
        return reread(createKnownFiles(this.#self.entryFile, Object.entries(files)), this.#self);
    }

    toMemory() {
        return { entryFile: this.#self.entryFile, files: { ...this.#state.texts } };
    }

    [SPAN_OF](of: Definition | Reference): Span {
        const newSpan = this.#state.newSpans.get(of);
        if (newSpan) return newSpan;
        return "source" in of
            ? DefinitionObject.getSpan(of as DefinitionObject)
            : getReferenceSpan(of);
    }

    has(path: string) {
        return this.#self.permutations.some((each) => each.getTokenOrGroup(path) !== undefined);
    }

    get #self(): DesignTokens {
        return this as unknown as DesignTokens;
    }
}

export function createTokenObject(fields: TokenFields): Token {
    return new TokenObject(fields) as unknown as Token;
}

export function createGroupObject(fields: GroupFields): Group {
    return new GroupObject(fields) as unknown as Group;
}

export function createPermutation(
    fields: PermutationFields,
    tokens: ReadonlyMap<string, Token>,
    groups: ReadonlyMap<string, Group>,
): Permutation {
    return new PermutationObject(fields, tokens, groups) as unknown as Permutation;
}

export function createModifier(fields: ResolverModifier): ResolverModifier {
    return Object.assign(Object.create(modifierShared), fields);
}

export function createContext(fields: ResolverContext): ResolverContext {
    return Object.assign(Object.create(contextShared), fields);
}

class SourceObject {
    readonly #position: number;

    constructor(fields: Source, position: number) {
        Object.assign(this, fields);
        this.#position = position;
    }

    static positionOf(source: Source): number {
        return (source as unknown as SourceObject).#position;
    }

    toJSON() {
        const { modifier, ...fields } = this as unknown as Source;
        return modifier ? { ...fields, modifier: modifier.name } : fields;
    }
}

export function createSource(fields: Source, position: number): Source {
    return new SourceObject(fields, position) as unknown as Source;
}

class DefinitionObject {
    readonly source: Source;
    readonly #span: Span;
    #asList: Definition[] | undefined;
    #text: string | undefined;
    #textAt: Span;
    #json: JsonValue | undefined;

    constructor(source: Source, span: Span, text: string | undefined) {
        this.source = source;
        this.#span = span;
        this.#text = text;
        this.#textAt = span;
    }

    get json(): JsonValue {
        if (this.#json === undefined) {
            this.#json = parse(sliceSpan(this.#text, this.#textAt) ?? "null");
            this.#text = undefined;
        }
        return this.#json as JsonValue;
    }

    static getSpan(definition: DefinitionObject): Span {
        return definition.#span;
    }

    static setText(definition: DefinitionObject, text: string | undefined, span: Span): void {
        if (definition.#json !== undefined) return;
        definition.#text = text;
        definition.#textAt = span;
    }

    static asList(definition: DefinitionObject): Definition[] {
        definition.#asList ??= [definition];
        return definition.#asList;
    }

    toJSON() {
        return { source: SourceObject.positionOf(this.source) };
    }
}

export interface DefinitionTracker {
    at(source: Source, span: Span, path: string): Definition;
    getList(source: Source, span: Span, path: string): Definition[];
    recordMoves(references: readonly Reference[], spans: readonly Span[]): void;
    readonly newSpans: ReadonlyMap<Definition | Reference, Span>;
}

export function createDefinitionTracker(
    texts: Readonly<Record<string, string>>,
    previous: DesignTokens | undefined,
): DefinitionTracker {
    const bySpan = new Map<Span, DefinitionObject[]>();
    const newSpans = new Map<Definition | Reference, Span>();
    const checked = new Set<readonly Reference[]>();
    const before = previous && indexDefinitions(previous);
    const findReusable = (source: Source, span: Span, path: string, text: string | undefined) => {
        if (!previous || !before) return undefined;
        for (const each of before.get(path) ?? []) {
            if (each.source !== source || !sameText(previous, each, text, span)) continue;
            if (previous.getText(span.file) !== text) DefinitionObject.setText(each, text, span);
            if (!sameSpan(DefinitionObject.getSpan(each), span)) newSpans.set(each, span);
            return each;
        }
        return undefined;
    };
    const at = (source: Source, span: Span, path: string): DefinitionObject => {
        const atSpan = bySpan.get(span);
        const found = atSpan?.find((each) => each.source === source);
        if (found) return found;
        const text = texts[span.file];
        const definition =
            findReusable(source, span, path, text) ?? new DefinitionObject(source, span, text);
        if (atSpan) atSpan.push(definition);
        else bySpan.set(span, [definition]);
        return definition;
    };
    return {
        at,
        getList: (source, span, path) => DefinitionObject.asList(at(source, span, path)),
        recordMoves: (references, spans) => {
            if (!previous || checked.has(references)) return;
            checked.add(references);
            for (const [index, reference] of references.entries()) {
                const span = spans[index];
                if (span && !sameSpan(getReferenceSpan(reference), span))
                    newSpans.set(reference, span);
            }
        },
        newSpans,
    };
}

function indexDefinitions(tokens: DesignTokens): Map<string, DefinitionObject[]> {
    const byPath = new Map<string, DefinitionObject[]>();
    const seen = new Set<{ readonly definitions: readonly Definition[] }>();
    const add = (path: string, each: { readonly definitions: readonly Definition[] }) => {
        if (seen.has(each)) return;
        seen.add(each);
        const list = byPath.get(path) ?? [];
        byPath.set(path, list);
        for (const definition of each.definitions as DefinitionObject[]) {
            if (!list.includes(definition)) list.push(definition);
        }
    };
    for (const permutation of tokens.permutations) {
        for (const token of permutation.tokens) add(token.path, token);
        for (const group of permutation.groups) add(group.path, group);
    }
    return byPath;
}

function sameText(
    previous: DesignTokens,
    definition: Definition,
    text: string | undefined,
    span: Span,
): boolean {
    const was = getSpan(previous, definition);
    const then = previous.getText(was.file);
    if (then === text) return sameOffsets(was, span);
    return sliceSpan(then, was) === sliceSpan(text, span);
}

function sliceSpan(text: string | undefined, { offset, length }: Span): string | undefined {
    return text?.slice(offset, offset + length);
}

function sameSpan(a: Span, b: Span): boolean {
    return (
        sameOffsets(a, b) &&
        a.start.line === b.start.line &&
        a.start.column === b.start.column &&
        a.end.line === b.end.line &&
        a.end.column === b.end.column
    );
}

function sameOffsets(a: Span, b: Span): boolean {
    return a.file === b.file && a.offset === b.offset && a.length === b.length;
}

export function createDesignTokens(fields: DesignTokensFields, state: ReadState): DesignTokens {
    const tokens = new DesignTokensObject(fields, state) as unknown as DesignTokens;
    for (const permutation of tokens.permutations) {
        PermutationObject.setOwner(permutation as unknown as PermutationObject, tokens);
    }
    return tokens;
}

function allPaths(tokens: DesignTokens, kind: "tokens" | "groups"): string[] {
    const found = new Set<string>();
    for (const permutation of tokens.permutations) {
        for (const { path } of permutation[kind]) found.add(path);
    }
    return [...found];
}

function paths(items: readonly (Token | Group)[]): string[] {
    return items.map(({ path }) => path);
}
