import type { DesignTokens, Input, Permutation, ResolverModifier, Token } from "../model.js";
import { findByName } from "../read/input.js";
import { canStack } from "./can-stack.js";
import { type CSSDeclaration, type CSSWriter, createCSSWriter } from "./writer.js";

/** One block of custom properties, with its input and selector. */
export interface CSSBlockInput {
    /**
     * The input naming the block's permutation, such as `{ mode: "dark" }`.
     *
     * It overrides what earlier blocks write for its modifiers. So a `{ mode: "light" }` section
     * inside a dark page is light.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#orthogonality | Resolver 2.1, Orthogonality}
     */
    readonly input: Input;
    /** The selector, such as `'[data-mode="dark"]'`, or an array of them. */
    readonly selector: string | readonly string[];
    /**
     * The at-rules around the block, outermost first.
     *
     * For example, `["@media (min-width: 640px)"]`.
     */
    readonly atRules?: readonly string[];
    /**
     * When this block gives a custom property a new value, it also writes again the custom
     * properties that refer to it.
     *
     * Say a dark block changes `--color-primary`, and `:root` has
     * `--button-background: var(--color-primary)`. The dark block must write `--button-background`
     * again. Otherwise buttons in dark keep the light primary.
     *
     * If the block only ever matches `<html>`, such as `:root.dark`, you can turn this off.
     * Everything is already on `<html>`, so nothing needs writing again.
     *
     * @default true
     */
    readonly redeclare?: boolean;
}

/** A block, with the custom properties it writes. */
export interface CSSBlock extends CSSBlockInput {
    /** Every custom property of the block's permutation. */
    readonly declarations: readonly CSSDeclaration[];
    /** The custom properties the block writes in its rule. */
    readonly inRule: readonly CSSDeclaration[];
    /** The custom properties whose `@supports` alternatives the block writes. */
    readonly underSupports: readonly CSSDeclaration[];
}

/**
 * Works out what each block of a stylesheet writes.
 *
 * A block leaves out what earlier blocks already set to the same value. List blocks in the
 * resolver's order.
 *
 * @param tokens - The tokens, as `read` returns them.
 * @param blocks - Each block's input and selector, such as `{ input: {}, selector: ":root" }`.
 * @param options - The writer to use, from {@link createCSSWriter}. Without one, it uses a writer
 * with no settings.
 * @throws {@link PermutationError} If a block's input names a permutation the tokens don't have.
 *
 * @see {@link https://github.com/sugarcube-sh/sugarcube/tree/main/packages/dtcg#write-a-stylesheet | Write a stylesheet, in the README}
 *
 * @example
 * // Light under :root, and only what changes in dark under [data-mode="dark"]
 * toCSS(
 *     getCSSBlocks(tokens, [
 *         { input: {}, selector: ":root" },
 *         { input: { mode: "dark" }, selector: '[data-mode="dark"]' },
 *     ]),
 * )
 * // =>
 * // :root {
 * //     --color-blue-500: rgb(51 102 204);
 * //     --color-blue-300: rgb(102 153 255);
 * //     --color-primary: var(--color-blue-500);
 * //     --button-background: var(--color-primary);
 * // }
 * //
 * // [data-mode="dark"] {
 * //     --color-primary: var(--color-blue-300);
 * //     --button-background: var(--color-primary);
 * // }
 */
export function getCSSBlocks(
    tokens: DesignTokens,
    blocks: readonly CSSBlockInput[],
    { writer = createCSSWriter() }: { writer?: CSSWriter } = {},
): CSSBlock[] {
    const blocksWithDeclarations = blocks.map((each) => {
        const permutation = tokens.getPermutation(each.input);
        return {
            ...each,
            permutation,
            declarations: writer.getDeclarations(permutation).declarations,
        };
    });
    const pathsByModifier = allPathsByModifier(blocksWithDeclarations);
    const made: CSSBlock[] = [];
    for (const { permutation, ...block } of blocksWithDeclarations) {
        const inEffect = new Map<string, CSSDeclaration>();
        const elsewhere = new Map<string, Set<string>>();
        for (const earlier of made) {
            if (reaches(earlier, block)) {
                for (const line of earlier.declarations) inEffect.set(line.name, line);
                continue;
            }
            for (const { name, value } of earlier.inRule) {
                const values = elsewhere.get(name);
                if (values) values.add(value);
                else elsewhere.set(name, new Set([value]));
            }
        }
        const own = ownership(block.input, permutation, pathsByModifier);
        const all = block.declarations;
        const changed = all.filter(
            (line) =>
                hasChanged(inEffect.get(line.name), line) ||
                (own(line.token) && disputed(elsewhere.get(line.name), line.value)),
        );
        const inRule =
            block.redeclare === false ? changed : [...changed, ...dependents(all, changed)];
        const names = new Set(inRule.map(({ name }) => name));
        const underSupports = all.filter(
            (line) =>
                line.supports !== undefined &&
                (names.has(line.name) ||
                    !sameSupports(inEffect.get(line.name)?.supports, line.supports)),
        );
        made.push({ ...block, inRule, underSupports });
    }
    return made;
}

function reaches(earlier: CSSBlockInput, later: CSSBlockInput): boolean {
    const reach = [earlier.selector].flat();
    const target = [later.selector].flat();
    const everyElement = reach.includes(":root") || target.every((each) => reach.includes(each));
    return everyElement && everyScreen(earlier.atRules ?? [], later.atRules ?? []);
}

function everyScreen(earlier: readonly string[], later: readonly string[]): boolean {
    if (earlier.length === 0) return true;
    if (earlier.length === later.length && earlier.every((each, index) => each === later[index])) {
        return true;
    }
    return earlier.length === 1 && later.length === 1 && canStack(earlier[0], later[0]);
}

function allPathsByModifier(
    blocks: readonly { declarations: readonly CSSDeclaration[] }[],
): Map<ResolverModifier, Set<string>> {
    const pathsByModifier = new Map<ResolverModifier, Set<string>>();
    for (const { declarations } of blocks) {
        for (const { token } of declarations) {
            for (const { source } of token.definitions) {
                const { modifier } = source;
                if (!modifier) continue;
                const paths = pathsByModifier.get(modifier);
                if (paths) paths.add(token.path);
                else pathsByModifier.set(modifier, new Set([token.path]));
            }
        }
    }
    return pathsByModifier;
}

function ownership(
    input: Input,
    permutation: Permutation,
    pathsByModifier: Map<ResolverModifier, Set<string>>,
): (token: Token) => boolean {
    const named = Object.keys(input);
    const decided = permutation.contexts
        .map(({ modifier }) => modifier)
        .filter(({ name }) => findByName(named, name, (each) => each) !== undefined);
    if (decided.length === permutation.contexts.length) return () => true;
    const paths = decided.flatMap((modifier) => {
        const found = pathsByModifier.get(modifier);
        return found ? [found] : [];
    });
    return ({ path }) => paths.some((each) => each.has(path));
}

function disputed(values: Set<string> | undefined, value: string): boolean {
    if (!values) return false;
    for (const each of values) if (each !== value) return true;
    return false;
}

function hasChanged(earlier: CSSDeclaration | undefined, line: CSSDeclaration): boolean {
    return earlier?.value !== line.value || (earlier.supports !== undefined && !line.supports);
}

function sameSupports(
    earlier: CSSDeclaration["supports"],
    later: NonNullable<CSSDeclaration["supports"]>,
): boolean {
    return (
        earlier?.length === later.length &&
        earlier.every(
            (each, index) =>
                each.condition === later[index]?.condition && each.value === later[index]?.value,
        )
    );
}

function dependents(
    all: readonly CSSDeclaration[],
    changed: readonly CSSDeclaration[],
): CSSDeclaration[] {
    const users = new Map<string, CSSDeclaration[]>();
    for (const line of all) {
        for (const { path } of line.dependencies) {
            const found = users.get(path);
            if (found) found.push(line);
            else users.set(path, [line]);
        }
    }
    const reached = new Set<string>();
    const queue = [...new Set(changed.map(({ token }) => token.path))];
    for (const path of queue) {
        for (const { token } of users.get(path) ?? []) {
            if (reached.has(token.path)) continue;
            reached.add(token.path);
            queue.push(token.path);
        }
    }
    const written = new Set(changed.map(({ name }) => name));
    return all.filter(({ name, token }) => reached.has(token.path) && !written.has(name));
}
