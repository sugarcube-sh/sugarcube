import type { Change, Move } from "./change.js";
import { type DefinitionInPermutations, type Definition, DefinitionObject } from "./definition.js";
import type { Diagnostic } from "./diagnostic.js";
import type { Group } from "./group.js";
import type { ParseOptions } from "./parse.js";
import { type Input, type Permutation, PermutationObject } from "./permutation.js";
import { type Permutations, makePermutations } from "./permutations.js";
import type { TokensInMemory } from "./read-options.js";
import {
    type ReferenceInPermutations,
    type ReferenceOptions,
    getReferenceSpan,
    toReferenceInPermutations,
    type Reference,
} from "./reference.js";
import type { Resolver } from "./resolver.js";
import type { Source } from "./source.js";
import type { Token } from "./token.js";
import { Changes, diffGroup, diffToken, pairByPath } from "../lookup/changes-since.js";
import { createDiagnosticFilter } from "../lookup/diagnostics.js";
import { getSpan, SPAN_OF } from "../lookup/editor.js";
import { findJsonPath } from "../lookup/json-path.js";
import { findPermutation, getOnlyPermutation, PermutationError } from "../lookup/permutation.js";
import { createKnownFiles, type KnownFiles, withChanges } from "../read/files/known.js";
import { samePropertyPath } from "./location.js";
import type { Span } from "./location.js";

/**
 * Design tokens, as {@link read} returns them, with every permutation.
 *
 * Everything in them is read-only. A token or group that's the same in two permutations is one
 * object in both, so `===` tells whether it differs.
 *
 * @example
 * // color.blue.500 is the same in light and dark
 * light.getToken("color.blue.500") === dark.getToken("color.blue.500")
 * // => true
 */
export interface DesignTokens {
    /**
     * Every file the read used, the entry file first.
     *
     * Paths are relative to the entry file's folder, such as `"dark.json"`.
     */
    readonly files: readonly string[];
    /** The file the read started from, such as `"tokens.resolver.json"`. */
    readonly entryFile: string;
    /** The resolver, if the read started from one. */
    readonly resolver?: Resolver;
    /** Every source the read used, each once. */
    readonly sources: readonly Source[];
    /**
     * Every permutation the read built, in the resolver's order.
     *
     * The default isn't always first. To get it, use `getPermutation()`.
     */
    readonly permutations: Permutations;
    /**
     * How the values were read.
     *
     * To read a value in `$extensions` the same way, pass these to `parseValue` or
     * `createExtensionReader`.
     */
    readonly parseOptions: Required<ParseOptions>;
    /**
     * Every problem the read found.
     *
     * For one token or group, use {@link DesignTokens.getDiagnostics | getDiagnostics}. For a place
     * in a file, use `getDiagnosticsAt`.
     */
    readonly diagnostics: readonly Diagnostic[];
    /**
     * Finds every reference to a token or group, in any file.
     *
     * Each is listed once, with the tokens that write it and the permutations it applies in. To
     * follow chains of references, use {@link Permutation.getReferencesTo}.
     *
     * @param path - The token or group, such as `"color.primary"`.
     *
     * @example
     * // Nothing refers to button.background
     * tokens.getReferencesTo("button.background").length
     * // => 0
     */
    getReferencesTo(path: string): readonly ReferenceInPermutations[];
    /**
     * Finds every place a token or group is written, in any permutation.
     *
     * @param path - The token or group, such as `"color.primary"`.
     *
     * @example
     * // color.json and dark.json both write color.primary
     * tokens.getDefinitions("color.primary").map((definition) => definition.span.file)
     * // => ["color.json", "dark.json"]
     */
    getDefinitions(path: string): readonly DefinitionInPermutations[];
    /**
     * Gets the permutation for an input.
     *
     * Without an input, it returns the default permutation.
     *
     * @param input - The input, such as `{ mode: "dark" }`.
     * @throws {@link PermutationError} If no permutation the read built fits the input.
     *
     * @example
     * // The dark permutation
     * tokens.getPermutation({ mode: "dark" }).label
     * // => "mode: dark"
     */
    getPermutation(input?: Input): Permutation;
    /**
     * Gets the permutations that read a file.
     *
     * @param file - The file, such as `"dark.json"`.
     *
     * @example
     * // Only dark reads dark.json
     * tokens.getPermutationsReading("dark.json").label
     * // => "mode: dark"
     */
    getPermutationsReading(file: string): Permutations;
    /**
     * Gets the token at a path, when the read has one permutation.
     *
     * It's {@link Permutation.getToken} for that permutation.
     *
     * @param path - The token's path, such as `"color.primary"`.
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    getToken(path: string): Token | undefined;
    /**
     * Gets the group at a path, when the read has one permutation.
     *
     * It's {@link Permutation.getGroup} for that permutation.
     *
     * @param path - The group's path, such as `"color.blue"`, or `""` for the top level.
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    getGroup(path: string): Group | undefined;
    /**
     * Gets the token or group at a path, when the read has one permutation.
     *
     * It's {@link Permutation.getTokenOrGroup} for that permutation.
     *
     * @param path - The token or group, such as `"color.primary"`.
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    getTokenOrGroup(path: string): Token | Group | undefined;
    /**
     * Finds what refers to a token or group, when the read has one permutation.
     *
     * It's {@link Permutation.getDependents} for that permutation. To check every permutation, use
     * {@link DesignTokens.getReferencesTo | getReferencesTo}.
     *
     * @param path - The token or group, such as `"color.primary"`.
     * @param options - `{ chained: true }` to follow references through other tokens too.
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    getDependents(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * Finds what a token or group refers to, when the read has one permutation.
     *
     * It's {@link Permutation.getDependencies} for that permutation.
     *
     * @param path - The token or group, such as `"color.primary"`.
     * @param options - `{ chained: true }` to follow references through other tokens too.
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    getDependencies(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * Every token, when the read has one permutation.
     *
     * It's {@link Permutation.tokens} for that permutation.
     *
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    readonly tokens: readonly Token[];
    /**
     * Every group, when the read has one permutation.
     *
     * It's {@link Permutation.groups} for that permutation.
     *
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    readonly groups: readonly Group[];
    /**
     * The tokens and groups at the top of the files, when the read has one permutation.
     *
     * It's {@link Permutation.children} for that permutation.
     *
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    readonly children: readonly (Token | Group)[];
    /**
     * The top level of the files, the group at `""`, when the read has one permutation.
     *
     * It's {@link Permutation.topLevel} for that permutation.
     *
     * @throws {@link SeveralPermutationsError} If the read has several permutations.
     */
    readonly topLevel: Group;
    /**
     * Gets every token's path, in any permutation, each once.
     *
     * @example
     * // Every token path
     * tokens.getTokenPaths()
     * // => ["color.blue.500", "color.blue.300", "color.primary", "button.background"]
     */
    getTokenPaths(): readonly string[];
    /**
     * Gets every group's path, in any permutation, each once, starting with the top level's `""`.
     */
    getGroupPaths(): readonly string[];
    /**
     * Checks whether a token or group is at a path, in any permutation.
     *
     * @param path - The path, such as `"color.blue"`.
     *
     * @example
     * // color.blue is a group
     * tokens.has("color.blue")
     * // => true
     */
    has(path: string): boolean;
    /**
     * Gets a file's text, exactly as read.
     *
     * It returns `undefined` for a file the read didn't use.
     *
     * @param file - The file, such as `"dark.json"`.
     */
    getText(file: string): string | undefined;
    /**
     * Reads the tokens again, after some files changed.
     *
     * It uses the same entry file and options, and gives what a fresh read of the same files
     * gives. These tokens don't change.
     *
     * @param changed - Each changed file's new text, such as `{ "dark.json": text }`. Pass `null`
     * for a deleted file.
     *
     * @throws `TypeError` If the tokens came from `read` and a changed file now points at a file
     * that read never fetched. Pass that file's text too, or read again.
     *
     * @example
     * // dark.json now points color.primary at color.blue.500
     * const next = tokens.reread({ "dark.json": text });
     * next.getPermutation({ mode: "dark" }).getToken("color.primary")?.value
     * // => { syntax: "curly-brace", path: "color.blue.500" }
     */
    reread(changed: Readonly<Record<string, string | null>>): DesignTokens;
    /**
     * Reads the tokens again, from every file's text as it is now.
     *
     * A file you leave out is read as deleted. If no file changed, it returns these same tokens. If
     * you know which files changed, use {@link DesignTokens.reread}.
     *
     * @param files - Every file's text, such as `tokens.toMemory().files`.
     *
     * @example
     * // Nothing changed
     * tokens.rereadAll(tokens.toMemory().files) === tokens
     * // => true
     */
    rereadAll(files: Readonly<Record<string, string>>): DesignTokens;
    /**
     * Gets the entry file and every file's text, to read them somewhere else.
     *
     * Pass the result to {@link readFromMemory}, with the same options, to get the same tokens.
     *
     * @example
     * // Every file the read used
     * Object.keys(tokens.toMemory().files)
     * // => ["tokens.resolver.json", "color.json", "dark.json"]
     */
    toMemory(): TokensInMemory & { readonly entryFile: string };
    /**
     * Finds what changed since an earlier read.
     *
     * A token is compared by what it says, not what it resolves to. So changing `color.blue.500` is
     * one change, not one for every token that refers to it.
     *
     * @param before - An earlier read, such as the tokens before
     * {@link DesignTokens.reread | reread}.
     * @param options - `moves`, the {@link Move}s the edits made, in order.
     *
     * @example
     * // color.blue.500 has a new value in color.json
     * tokens.reread({ "color.json": text }).getChangesSince(tokens).map((change) => change.path)
     * // => ["color.blue.500"]
     */
    getChangesSince(before: DesignTokens, options?: { moves?: readonly Move[] }): readonly Change[];
    /**
     * Finds the problems with a token or group, in every permutation.
     *
     * Each comes with the permutations it's in. The kinds are as for
     * {@link Permutation.getDiagnostics}.
     *
     * @param path - The token or group, such as `"color.primary"`.
     */
    getDiagnostics(path: string): readonly Diagnostic[];
}

interface Merged {
    reference: Reference;
    ownerPaths: Set<string>;
    inheritedPaths: Set<string>;
    permutations: Permutation[];
}

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
