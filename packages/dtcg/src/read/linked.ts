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
import { concerning } from "../lookup/diagnostics.js";
import { Changes, groupChange, matched, tokenChange } from "../lookup/changes-since.js";
import { SPAN_OF, getSpan } from "../lookup/editor.js";
import { findJsonPath } from "../lookup/json-path.js";
import { buildParts } from "../lookup/parts.js";
import { PermutationError, findPermutation, onlyPermutation } from "../lookup/permutation.js";
import { isEquivalentValue } from "../values/same-value.js";
import { referenceIndex } from "../lookup/references.js";
import { tokenPath } from "../path.js";
import { makePermutations } from "./make-permutations.js";
import { getReferenceSpan, toReferenceInPermutations } from "./reference.js";
import { samePlace } from "./same-object.js";
import { type KnownFiles, knownInMemory, withChanges } from "./known-files.js";

export const NO_REFERENCES: readonly Reference[] = Object.freeze([]);
export const NO_DEFINITIONS: readonly Definition[] = Object.freeze([]);
export const NO_EXTENSION_DEFINITIONS: Readonly<Record<string, Definition>> = Object.freeze({});

interface Merged {
    reference: Reference;
    writers: Set<string>;
    heirs: Set<string>;
    permutations: Permutation[];
}

const NOT_YET = Symbol("not yet worked out");

type TokenFields = Omit<
    Token,
    "kind" | "getReferenceAt" | "aliasChain" | "winningDefinition" | "parts"
>;

type GroupFields = Omit<Group, "kind" | "childTokens" | "tokens">;

class TokenObject {
    #aliasChain: readonly Token[] | undefined;
    #parts: Part | undefined | typeof NOT_YET = NOT_YET;

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
        if (fields.asWritten) self.asWritten = fields.asWritten;
        if (fields.generated) self.generated = fields.generated;
        if (fields.inherited) self.inherited = fields.inherited;
    }

    getReferenceAt(property: JsonPath = []): Reference | undefined {
        return (this as unknown as Token).references.find((each) =>
            samePlace(each.writtenInProperty, property),
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
        if (this.#parts === NOT_YET) this.#parts = buildParts(this as unknown as Token);
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
        const reaching = (each: string, isToken: boolean): Reference[] => {
            if (isToken) return byPath.get(each) ?? [];
            return [...byPath].flatMap(([named, references]) =>
                tokenPath.contains(each, named) ? references : [],
            );
        };
        const first = reaching(path, this.getToken(path) !== undefined);
        const found = new Set<Reference>(first);
        const seen = new Set([path]);
        const waiting = chained ? [first] : [];
        for (const references of waiting) {
            for (const reference of references) {
                found.add(reference);
                const { writtenIn } = reference;
                if (seen.has(writtenIn.path)) continue;
                seen.add(writtenIn.path);
                waiting.push(reaching(writtenIn.path, writtenIn.kind === "token"));
            }
        }
        return [...found].sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0));
    }

    getDependents(path: string, options?: ReferenceOptions): (Token | Group)[] {
        return [...new Set(this.getReferencesTo(path, options).map(({ writtenIn }) => writtenIn))];
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
            const there = other.getToken(token.path);
            if (there === token) return false;
            if (there === undefined || there.type !== token.type) return true;
            if (token.resolved === undefined || there.resolved === undefined)
                return token.resolved !== there.resolved;
            return !isEquivalentValue(token.type, token.resolved, there.resolved);
        });
    }

    getDiagnostics(path: string): Diagnostic[] {
        const tokens = this.#designTokens as DesignTokens;
        const permutation = this.#self;
        const about = concerning(tokens, path, [permutation]);
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

    static belongsTo(permutation: PermutationObject, tokens: DesignTokens): void {
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

interface Kept {
    texts: Readonly<Record<string, string>>;
    moved: ReadonlyMap<Definition | Reference, Span>;
    known: KnownFiles;
    readAgain(known: KnownFiles, previous: DesignTokens): DesignTokens;
}

type DesignTokensFields = Omit<DesignTokens, keyof DesignTokensObject>;

class DesignTokensObject {
    readonly #kept: Kept;

    constructor(fields: DesignTokensFields, kept: Kept) {
        Object.assign(this, fields);
        this.#kept = kept;
    }

    getReferencesTo(path: string): ReferenceInPermutations[] {
        const tokens = this.#self;
        const merged = new Map<Span, Merged[]>();
        for (const permutation of tokens.permutations) {
            for (const reference of permutation.getReferencesTo(path)) {
                const span = getSpan(tokens, reference);
                let atSpan = merged.get(span);
                if (!atSpan) merged.set(span, (atSpan = []));
                let here = atSpan.find((each) =>
                    samePlace(each.reference.writtenInProperty, reference.writtenInProperty ?? []),
                );
                if (!here) {
                    here = { reference, writers: new Set(), heirs: new Set(), permutations: [] };
                    atSpan.push(here);
                }
                if (!here.permutations.includes(permutation)) here.permutations.push(permutation);
                const { writtenIn } = reference;
                (writtenIn.inherited ? here.heirs : here.writers).add(writtenIn.path);
            }
        }
        return [...merged].flatMap(([span, here]) =>
            here.map(({ reference, writers, heirs, permutations }) =>
                toReferenceInPermutations(
                    reference,
                    [...new Set([...writers, ...heirs])],
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
            const places = [
                ...(permutation.getToken(path)?.definitions ?? []),
                ...(permutation.getGroup(path)?.definitions ?? []),
            ];
            for (const place of places) {
                const { source } = place;
                const span = getSpan(tokens, place);
                const known = found.get(span);
                if (!known) {
                    found.set(span, {
                        sources: [source],
                        permutations: [permutation],
                        first: place,
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
            get asWritten() {
                return first.asWritten;
            },
            sources,
            permutations: makePermutations(permutations, tokens.permutations),
            winsIn: makePermutations(
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

    getToken(path: string) {
        return onlyPermutation(this.#self, "getToken()").getToken(path);
    }

    getGroup(path: string) {
        return onlyPermutation(this.#self, "getGroup()").getGroup(path);
    }

    getDependents(path: string, options?: ReferenceOptions) {
        return onlyPermutation(this.#self, "getDependents()").getDependents(path, options);
    }

    getDependencies(path: string, options?: ReferenceOptions) {
        return onlyPermutation(this.#self, "getDependencies()").getDependencies(path, options);
    }

    get tokens() {
        return onlyPermutation(this.#self, "tokens").tokens;
    }

    get groups() {
        return onlyPermutation(this.#self, "groups").groups;
    }

    get children() {
        return onlyPermutation(this.#self, "children").children;
    }

    get topLevel() {
        return onlyPermutation(this.#self, "topLevel").topLevel;
    }

    getTokenOrGroup(path: string) {
        return onlyPermutation(this.#self, "getTokenOrGroup()").getTokenOrGroup(path);
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
        return tokens.diagnostics.filter(concerning(tokens, path, tokens.permutations));
    }

    getChangesSince(before: DesignTokens, options?: { moved?: Move[] }): Change[] {
        const moved = options?.moved ?? [];
        const changes = new Changes();
        for (const now of this.#self.permutations) {
            const was = findPermutation(before, now.input);
            if ("reason" in was) continue;
            for (const pair of matched(was.groups, now.groups, moved)) {
                if (pair.before !== pair.after) changes.add(groupChange(pair, moved), now);
            }
            for (const pair of matched(was.tokens, now.tokens, moved)) {
                if (pair.before !== pair.after) changes.add(tokenChange(pair, moved), now);
            }
        }
        return changes.list(this.#self.permutations);
    }

    getText(file: string): string | undefined {
        return this.#kept.texts[file];
    }

    reread(changed: Readonly<Record<string, string | null>>) {
        const { known, readAgain } = this.#kept;
        return readAgain(withChanges(known, changed), this.#self);
    }

    rereadAll(files: Readonly<Record<string, string>>) {
        const { texts, readAgain } = this.#kept;
        const unchanged =
            Object.keys(texts).every((file) => file in files) &&
            Object.entries(files).every(([file, text]) => texts[file] === text);
        if (unchanged) return this.#self;
        return readAgain(knownInMemory(this.#self.entryFile, Object.entries(files)), this.#self);
    }

    toMemory() {
        return { entryFile: this.#self.entryFile, files: { ...this.#kept.texts } };
    }

    [SPAN_OF](of: Definition | Reference): Span {
        const moved = this.#kept.moved.get(of);
        if (moved) return moved;
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

export function linkedToken(fields: TokenFields): Token {
    return new TokenObject(fields) as unknown as Token;
}

export function linkedGroup(fields: GroupFields): Group {
    return new GroupObject(fields) as unknown as Group;
}

export function linkedPermutation(
    fields: PermutationFields,
    tokens: ReadonlyMap<string, Token>,
    groups: ReadonlyMap<string, Group>,
): Permutation {
    return new PermutationObject(fields, tokens, groups) as unknown as Permutation;
}

export function linkedModifier(fields: ResolverModifier): ResolverModifier {
    return Object.assign(Object.create(modifierShared), fields);
}

export function linkedContext(fields: ResolverContext): ResolverContext {
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

export function withPosition(fields: Source, position: number): Source {
    return new SourceObject(fields, position) as unknown as Source;
}

class DefinitionObject {
    readonly source: Source;
    readonly #span: Span;
    #alone: Definition[] | undefined;
    #text: string | undefined;
    #textAt: Span;
    #written: JsonValue | undefined;

    constructor(source: Source, span: Span, text: string | undefined) {
        this.source = source;
        this.#span = span;
        this.#text = text;
        this.#textAt = span;
    }

    get asWritten(): JsonValue {
        if (this.#written === undefined) {
            this.#written = parse(sliceSpan(this.#text, this.#textAt) ?? "null");
            this.#text = undefined;
        }
        return this.#written as JsonValue;
    }

    static getSpan(place: DefinitionObject): Span {
        return place.#span;
    }

    static foundIn(place: DefinitionObject, text: string | undefined, span: Span): void {
        if (place.#written !== undefined) return;
        place.#text = text;
        place.#textAt = span;
    }

    static alone(place: DefinitionObject): Definition[] {
        place.#alone ??= [place];
        return place.#alone;
    }

    toJSON() {
        return { source: SourceObject.positionOf(this.source) };
    }
}

export interface Places {
    at(source: Source, span: Span, path: string): Definition;
    only(source: Source, span: Span, path: string): Definition[];
    movedTo(references: readonly Reference[], spans: readonly Span[]): void;
    readonly moved: ReadonlyMap<Definition | Reference, Span>;
}

export function trackPlaces(
    texts: Readonly<Record<string, string>>,
    previous: DesignTokens | undefined,
): Places {
    const made = new Map<Span, DefinitionObject[]>();
    const moved = new Map<Definition | Reference, Span>();
    const checked = new Set<readonly Reference[]>();
    const before = previous && indexDefinitions(previous);
    const kept = (source: Source, span: Span, path: string, text: string | undefined) => {
        if (!previous || !before) return undefined;
        for (const each of before.get(path) ?? []) {
            if (each.source !== source || !writtenAlike(previous, each, text, span)) continue;
            if (previous.getText(span.file) !== text) DefinitionObject.foundIn(each, text, span);
            if (!sameSpan(DefinitionObject.getSpan(each), span)) moved.set(each, span);
            return each;
        }
        return undefined;
    };
    const at = (source: Source, span: Span, path: string): DefinitionObject => {
        const atSpan = made.get(span);
        const found = atSpan?.find((each) => each.source === source);
        if (found) return found;
        const text = texts[span.file];
        const place = kept(source, span, path, text) ?? new DefinitionObject(source, span, text);
        if (atSpan) atSpan.push(place);
        else made.set(span, [place]);
        return place;
    };
    return {
        at,
        only: (source, span, path) => DefinitionObject.alone(at(source, span, path)),
        movedTo: (references, spans) => {
            if (!previous || checked.has(references)) return;
            checked.add(references);
            for (const [index, reference] of references.entries()) {
                const span = spans[index];
                if (span && !sameSpan(getReferenceSpan(reference), span))
                    moved.set(reference, span);
            }
        },
        moved,
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
        for (const place of each.definitions as DefinitionObject[]) {
            if (!list.includes(place)) list.push(place);
        }
    };
    for (const permutation of tokens.permutations) {
        for (const token of permutation.tokens) add(token.path, token);
        for (const group of permutation.groups) add(group.path, group);
    }
    return byPath;
}

function writtenAlike(
    previous: DesignTokens,
    place: Definition,
    text: string | undefined,
    span: Span,
): boolean {
    const was = getSpan(previous, place);
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

export function linkedDesignTokens(fields: DesignTokensFields, kept: Kept): DesignTokens {
    const tokens = new DesignTokensObject(fields, kept) as unknown as DesignTokens;
    for (const permutation of tokens.permutations) {
        PermutationObject.belongsTo(permutation as unknown as PermutationObject, tokens);
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
