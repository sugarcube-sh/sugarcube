import { parse } from "jsonc-parser";
import type {
    DesignTokens,
    Diagnostic,
    Group,
    Input,
    JsonPath,
    JsonValue,
    Move,
    Part,
    Permutation,
    Place,
    Reference,
    ReferenceOptions,
    ResolverContext,
    ResolverModifier,
    Source,
    Span,
    Token,
} from "../index.js";
import { diagnosticsAtIn, diagnosticsForIn, diagnosticsIn } from "../lookup/diagnostics.js";
import { diffIn } from "../lookup/diff.js";
import { partsOf } from "../lookup/parts.js";
import { modifierIn, permutationIn } from "../lookup/permutation.js";
import {
    referencedByIn,
    referencedIn,
    referencesIn,
    usedByIn,
    usedIn,
} from "../lookup/references.js";
import { resolvedValuesIn } from "../lookup/resolved-values.js";
import { writtenAtIn } from "../lookup/written-at.js";
import { spanOfReference } from "./reference.js";
import { samePlace } from "./same-object.js";

export const NO_REFERENCES: readonly Reference[] = Object.freeze([]);
export const NO_PLACES: readonly Place[] = Object.freeze([]);
export const NO_EXTENSION_PLACES: Readonly<Record<string, Place>> = Object.freeze({});

const NOT_YET = Symbol("not yet worked out");

type TokenFields = Omit<Token, "kind" | "referenceAt" | "aliasChain" | "valueFrom" | "parts">;

type GroupFields = Omit<Group, "kind" | "childTokens" | "tokens">;

class TokenObject {
    #aliasChain: readonly Token[] | undefined;
    #parts: Part | undefined | typeof NOT_YET = NOT_YET;

    constructor(fields: TokenFields) {
        const self = this as unknown as Record<string, unknown>;
        self.path = fields.path;
        self.type = fields.type;
        self.references = fields.references;
        self.writtenAt = fields.writtenAt;
        if (fields.value !== undefined) self.value = fields.value;
        if (fields.resolved !== undefined) self.resolved = fields.resolved;
        if (fields.invalid) self.invalid = fields.invalid;
        if (fields.description !== undefined) self.description = fields.description;
        if (fields.deprecated !== undefined) self.deprecated = fields.deprecated;
        if (fields.deprecatedFrom !== undefined) self.deprecatedFrom = fields.deprecatedFrom;
        if (fields.extensions) self.extensions = fields.extensions;
        if (fields.authored) self.authored = fields.authored;
        if (fields.generated) self.generated = fields.generated;
        if (fields.inherited) self.inherited = fields.inherited;
    }

    referenceAt(property: JsonPath = []): Reference | undefined {
        return (this as unknown as Token).references.find((each) =>
            samePlace(each.property, property),
        );
    }

    get aliasChain(): readonly Token[] {
        this.#aliasChain ??= aliasChainOf(this as unknown as Token);
        return this.#aliasChain;
    }

    get valueFrom(): Place {
        const { writtenAt } = this as unknown as Token;
        return writtenAt[writtenAt.length - 1] as Place;
    }

    get parts(): Part | undefined {
        if (this.#parts === NOT_YET) this.#parts = partsOf(this as unknown as Token);
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
        this.#tokens ??= tokensIn((this as unknown as Group).children);
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

function aliasChainOf(token: Token): Token[] {
    const chain: Token[] = [];
    for (let current: Token | undefined = token; current;) {
        if (chain.includes(current)) break;
        chain.push(current);
        current = current.referenceAt()?.token;
    }
    return chain;
}

export function tokensIn(children: readonly (Token | Group)[], found: Token[] = []): Token[] {
    for (const child of children) {
        if (child.kind === "token") found.push(child);
        else tokensIn(child.children, found);
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

    token(path: string): Token | undefined {
        return this.#tokens.get(path);
    }

    group(path: string): Group | undefined {
        return this.#groups.get(path);
    }

    referencedBy(path: string, options?: ReferenceOptions): Reference[] {
        return referencedIn(this.#self, path, options);
    }

    usedBy(path: string, options?: ReferenceOptions): (Token | Group)[] {
        return usedIn(this.#self, path, options);
    }

    diagnosticsFor(path: string): Diagnostic[] {
        return diagnosticsIn(this.#designTokens as DesignTokens, this.#self, path);
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
    moved: ReadonlyMap<Place | Reference, Span>;
    readFiles(files: Record<string, string>, previous: DesignTokens): DesignTokens;
}

type DesignTokensFields = Omit<DesignTokens, keyof DesignTokensObject>;

class DesignTokensObject {
    readonly #kept: Kept;

    constructor(fields: DesignTokensFields, kept: Kept) {
        Object.assign(this, fields);
        this.#kept = kept;
    }

    references(path: string, options?: ReferenceOptions) {
        return referencesIn(this.#self, path, options);
    }

    referencedBy(path: string, options?: ReferenceOptions) {
        return referencedByIn(this.#self, path, options);
    }

    usedBy(path: string, options?: ReferenceOptions) {
        return usedByIn(this.#self, path, options);
    }

    writtenAt(path: string) {
        return writtenAtIn(this.#self, path);
    }

    resolvedValues(path: string) {
        return resolvedValuesIn(this.#self, path);
    }

    permutation(input?: Input) {
        return permutationIn(this.#self, input);
    }

    modifier(name: string) {
        return modifierIn(this.#self, name);
    }

    tokenPaths() {
        return pathsIn(this.#self, "tokens");
    }

    groupPaths() {
        return pathsIn(this.#self, "groups");
    }

    toJSON() {
        const tokens = this.#self;
        return { ...tokens, permutations: [...tokens.permutations] };
    }

    diagnosticsFor(path: string) {
        return diagnosticsForIn(this.#self, path);
    }

    diagnosticsAt(place: Pick<Span, "file" | "offset" | "length">) {
        return diagnosticsAtIn(this.#self, place);
    }

    diff(before: DesignTokens, options?: { moved?: Move[] }) {
        return diffIn(this.#self, before, options);
    }

    text(file: string): string | undefined {
        return this.#kept.texts[file];
    }

    reread(changed: Readonly<Record<string, string | null>>) {
        const { texts, readFiles } = this.#kept;
        const files: Record<string, string> = { ...texts };
        for (const [file, text] of Object.entries(changed)) {
            if (text === null) delete files[file];
            else files[file] = text;
        }
        return readFiles(files, this.#self);
    }

    rereadAll(files: Readonly<Record<string, string>>) {
        const { texts, readFiles } = this.#kept;
        const unchanged =
            Object.keys(texts).every((file) => file in files) &&
            Object.entries(files).every(([file, text]) => texts[file] === text);
        return unchanged ? this.#self : readFiles({ ...files }, this.#self);
    }

    toMemory() {
        return { entry: this.#self.entry, files: { ...this.#kept.texts } };
    }

    spanOf(of: Place | Reference): Span {
        const moved = this.#kept.moved.get(of);
        if (moved) return moved;
        return "source" in of ? PlaceObject.spanOf(of as PlaceObject) : spanOfReference(of);
    }

    has(path: string) {
        return this.#self.permutations.some(
            (each) => (each.token(path) ?? each.group(path)) !== undefined,
        );
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

class PlaceObject {
    readonly source: Source;
    readonly #span: Span;
    #alone: Place[] | undefined;
    #text: string | undefined;
    #textAt: Span;
    #written: JsonValue | undefined;

    constructor(source: Source, span: Span, text: string | undefined) {
        this.source = source;
        this.#span = span;
        this.#text = text;
        this.#textAt = span;
    }

    get written(): JsonValue {
        if (this.#written === undefined) {
            this.#written = parse(textAt(this.#text, this.#textAt) ?? "null");
            this.#text = undefined;
        }
        return this.#written as JsonValue;
    }

    static spanOf(place: PlaceObject): Span {
        return place.#span;
    }

    static foundIn(place: PlaceObject, text: string | undefined, span: Span): void {
        if (place.#written !== undefined) return;
        place.#text = text;
        place.#textAt = span;
    }

    static alone(place: PlaceObject): Place[] {
        place.#alone ??= [place];
        return place.#alone;
    }

    toJSON() {
        return { source: SourceObject.positionOf(this.source) };
    }
}

export interface Places {
    at(source: Source, span: Span, path: string | undefined): Place;
    only(source: Source, span: Span, path: string | undefined): Place[];
    movedTo(references: readonly Reference[], spans: readonly Span[]): void;
    readonly moved: ReadonlyMap<Place | Reference, Span>;
}

export function placesIn(
    texts: Readonly<Record<string, string>>,
    previous: DesignTokens | undefined,
): Places {
    const made = new Map<Span, PlaceObject[]>();
    const moved = new Map<Place | Reference, Span>();
    const checked = new Set<readonly Reference[]>();
    const before = previous && placesBy(previous);
    const kept = (
        source: Source,
        span: Span,
        path: string | undefined,
        text: string | undefined,
    ) => {
        if (!previous || !before) return undefined;
        for (const each of before.get(path) ?? []) {
            if (each.source !== source || !writtenAlike(previous, each, text, span)) continue;
            if (previous.text(span.file) !== text) PlaceObject.foundIn(each, text, span);
            if (!sameSpan(PlaceObject.spanOf(each), span)) moved.set(each, span);
            return each;
        }
        return undefined;
    };
    const at = (source: Source, span: Span, path: string | undefined): PlaceObject => {
        const atSpan = made.get(span);
        const found = atSpan?.find((each) => each.source === source);
        if (found) return found;
        const text = texts[span.file];
        const place = kept(source, span, path, text) ?? new PlaceObject(source, span, text);
        if (atSpan) atSpan.push(place);
        else made.set(span, [place]);
        return place;
    };
    return {
        at,
        only: (source, span, path) => PlaceObject.alone(at(source, span, path)),
        movedTo: (references, spans) => {
            if (!previous || checked.has(references)) return;
            checked.add(references);
            for (const [index, reference] of references.entries()) {
                const span = spans[index];
                if (span && !sameSpan(spanOfReference(reference), span)) moved.set(reference, span);
            }
        },
        moved,
    };
}

function placesBy(tokens: DesignTokens): Map<string | undefined, PlaceObject[]> {
    const found = new Map<string | undefined, PlaceObject[]>();
    const seen = new Set<{ readonly writtenAt: readonly Place[] }>();
    const add = (path: string | undefined, each: { readonly writtenAt: readonly Place[] }) => {
        if (seen.has(each)) return;
        seen.add(each);
        const list = found.get(path) ?? [];
        found.set(path, list);
        for (const place of each.writtenAt as PlaceObject[]) {
            if (!list.includes(place)) list.push(place);
        }
    };
    for (const permutation of tokens.permutations) {
        add(undefined, permutation.root);
        for (const token of permutation.tokens) add(token.path, token);
        for (const group of permutation.groups) add(group.path, group);
    }
    return found;
}

function writtenAlike(
    previous: DesignTokens,
    place: Place,
    text: string | undefined,
    span: Span,
): boolean {
    const was = previous.spanOf(place);
    const then = previous.text(was.file);
    if (then === text) return sameOffsets(was, span);
    return textAt(then, was) === textAt(text, span);
}

function textAt(text: string | undefined, { offset, length }: Span): string | undefined {
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

function pathsIn(tokens: DesignTokens, kind: "tokens" | "groups"): string[] {
    const found = new Set<string>();
    for (const permutation of tokens.permutations) {
        for (const { path } of permutation[kind]) found.add(path);
    }
    return [...found];
}

function paths(items: readonly (Token | Group)[]): string[] {
    return items.map(({ path }) => path);
}
