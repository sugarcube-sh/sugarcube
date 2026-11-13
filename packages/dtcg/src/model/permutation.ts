import type { Diagnostic } from "./diagnostic.js";
import { type Group, paths } from "./group.js";
import type { Reference, ReferenceOptions } from "./reference.js";
import type { ResolverContext } from "./resolver.js";
import { type Source, SourceObject } from "./source.js";
import type { Token } from "./token.js";
import { createDiagnosticFilter } from "../lookup/diagnostics.js";
import { referenceIndex } from "../lookup/references.js";
import { tokenPath } from "../path.js";
import { isEquivalentValue } from "../values/same-value.js";
import type { DesignTokens } from "./design-tokens.js";

/**
 * A selection of contexts, such as `{ mode: "dark" }`.
 *
 * Each key is a modifier, and each value one of its contexts. A modifier left out takes its
 * default. Names match whatever their case. Each input gives one {@link Permutation}.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#inputs | Resolver 5, Inputs}
 */
export type Input = Readonly<Record<string, string>>;

/**
 * The tokens for one input.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#permutation | Resolver 2.2, Permutation}
 */
export interface Permutation {
    /** The permutation's input, with a context for every modifier. */
    readonly input: Input;
    /**
     * The permutation's name, such as `"mode: dark"`.
     *
     * It's `""` when there are no modifiers.
     */
    readonly label: string;
    /**
     * The sources the tokens come from, in order.
     *
     * When two write the same token, the later one wins.
     */
    readonly sources: readonly Source[];
    /**
     * The context for each modifier, in the order `resolutionOrder` names them.
     *
     * Defaults are filled in. It's `""` when there are no modifiers.
     *
     * @example
     * // The contexts that aren't defaults
     * dark.contexts.filter((context) => !context.isDefault).map((context) => context.name)
     * // => ["dark"]
     */
    readonly contexts: readonly ResolverContext[];
    /**
     * `true` when every modifier is at its `default`.
     *
     * @example
     * // light is the default
     * light.isDefault
     * // => true
     */
    readonly isDefault: boolean;
    /**
     * The top level of the files: the group at `""`, which holds everything else.
     *
     * By the spec's own definition, the top of a file is a group, so it has every group property,
     * `$extends` included.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#group-structure | Format 6.1, Group Structure}
     *
     * @example
     * // The same group by path
     * dark.topLevel === dark.getGroup("")
     * // => true
     */
    readonly topLevel: Group;
    /**
     * The tokens and groups at the top of the files, in the order read: the same list as
     * `topLevel.children`.
     *
     * @example
     * // The top of the files
     * dark.children.map((child) => child.path)
     * // => ["color", "button"]
     */
    readonly children: readonly (Token | Group)[];
    /**
     * Every token, in the order written, including invalid ones.
     *
     * A group's tokens stay together, whichever file adds them, and a token a later file writes
     * again keeps its place. Tokens from `$extends` or a {@link Generator} come last in their
     * group.
     *
     * To find one by path, use {@link Permutation.getToken | getToken}.
     *
     * @example
     * // Every token in dark
     * dark.tokens.map((token) => token.path)
     * // => ["color.blue.500", "color.blue.300", "color.primary", "button.background"]
     */
    readonly tokens: readonly Token[];
    /**
     * Every group, in the same order as {@link Permutation.tokens | tokens}, starting with the top
     * level, the group at `""`.
     *
     * To find one by path, use {@link Permutation.getGroup | getGroup}.
     */
    readonly groups: readonly Group[];
    /**
     * Gets the token at a path.
     *
     * It returns `undefined` if there's none, or a group is there.
     *
     * @param path - The token's path, such as `"color.primary"`.
     *
     * @example
     * // color.primary in dark
     * dark.getToken("color.primary")?.value
     * // => { syntax: "curly-brace", path: "color.blue.300" }
     */
    getToken(path: string): Token | undefined;
    /**
     * Gets the group at a path.
     *
     * @param path - The group's path, such as `"color.blue"`, or `""` for the top level.
     *
     * @example
     * // The tokens in color.blue
     * dark.getGroup("color.blue")?.tokens.map((token) => token.path)
     * // => ["color.blue.500", "color.blue.300"]
     */
    getGroup(path: string): Group | undefined;
    /**
     * Gets the token or group at a path.
     *
     * Check `kind` to tell which.
     *
     * @param path - The path, such as `"color"`.
     *
     * @example
     * // color is a group
     * dark.getTokenOrGroup("color")?.kind
     * // => "group"
     */
    getTokenOrGroup(path: string): Token | Group | undefined;
    /**
     * Finds every reference to a token or group in this permutation.
     *
     * For a group, it also finds `$extends` to it, and references to anything inside it. For every
     * permutation at once, use {@link DesignTokens.getReferencesTo}.
     *
     * @param path - The token or group, such as `"color.blue.300"`.
     * @param options - `{ chained: true }` to follow references through other tokens too.
     *
     * @example
     * // What refers to color.blue.300 in dark, directly or not
     * dark
     *     .getReferencesTo("color.blue.300", { chained: true })
     *     .map((reference) => reference.owner.path)
     * // => ["color.primary", "button.background"]
     */
    getReferencesTo(path: string, options?: ReferenceOptions): readonly Reference[];
    /**
     * Finds the tokens and groups a token or group refers to.
     *
     * A JSON Pointer to part of a token, such as one color component, counts as that token. For a
     * group, it's the group its `$extends` names. It's the reverse of
     * {@link Permutation.getDependents}.
     *
     * @param path - The token or group, such as `"button.background"`.
     * @param options - `{ chained: true }` to follow references through other tokens too.
     *
     * @example
     * // What button.background needs in dark, directly or not
     * dark.getDependencies("button.background", { chained: true }).map((token) => token.path)
     * // => ["color.primary", "color.blue.300"]
     */
    getDependencies(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * Finds the tokens and groups that refer to a token or group.
     *
     * That includes a border whose `color` refers to it, and a group that extends it.
     *
     * @param path - The token or group, such as `"color.primary"`.
     * @param options - `{ chained: true }` to follow references through other tokens too.
     *
     * @example
     * // What uses color.primary in dark
     * dark.getDependents("color.primary").map((token) => token.path)
     * // => ["button.background"]
     */
    getDependents(path: string, options?: ReferenceOptions): readonly (Token | Group)[];
    /**
     * Finds the tokens whose resolved value differs from another permutation's.
     *
     * A token that refers to a changed one is listed too, and so is one `other` doesn't have.
     * Values are compared as {@link isEquivalentValue} compares them.
     *
     * @param other - The permutation to compare with, such as `light`.
     *
     * @example
     * // What dark changes from light
     * dark.getTokensDifferentFrom(light).map((token) => token.path)
     * // => ["color.primary", "button.background"]
     */
    getTokensDifferentFrom(other: Permutation): readonly Token[];
    /**
     * Finds the problems with a token or group in this permutation.
     *
     * That includes a missing reference it writes, a loop it's part of, and a problem in a token it
     * gets through `$extends`.
     *
     * @param path - The token or group, such as `"color.primary"`.
     *
     * @example
     * // Show each problem with color.primary
     * for (const problem of dark.getDiagnostics("color.primary")) console.log(problem.message);
     */
    getDiagnostics(path: string): readonly Diagnostic[];
}

type PermutationFields = Omit<Permutation, keyof PermutationObject>;

export class PermutationObject {
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

export function createPermutation(
    fields: PermutationFields,
    tokens: ReadonlyMap<string, Token>,
    groups: ReadonlyMap<string, Group>,
): Permutation {
    return new PermutationObject(fields, tokens, groups) as unknown as Permutation;
}
