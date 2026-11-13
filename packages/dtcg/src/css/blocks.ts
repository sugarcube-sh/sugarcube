import type { DesignTokens, Input, Permutation, ResolverModifier, Token } from "../model/index.js";
import { findByName } from "../read/resolver/input.js";
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
    readonly ruleDeclarations: readonly CSSDeclaration[];
    /** The custom properties whose `@supports` alternatives the block writes. */
    readonly supportsDeclarations: readonly CSSDeclaration[];
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
    const result: CSSBlock[] = [];
    for (const { permutation, ...block } of blocksWithDeclarations) {
        const inEffect = findInEffect(result, block);
        const valuesThatMightApply = findValuesThatMightApply(result, block);
        const isSetByThisBlock = createSetByThisBlockCheck(
            block.input,
            permutation,
            pathsByModifier,
        );
        const ruleDeclarations = chooseRuleDeclarations(
            block,
            inEffect,
            valuesThatMightApply,
            isSetByThisBlock,
        );
        const supportsDeclarations = chooseSupportsDeclarations(block, ruleDeclarations, inEffect);
        result.push({ ...block, ruleDeclarations, supportsDeclarations });
    }
    return result;
}

type BlockWithDeclarations = CSSBlockInput & { readonly declarations: readonly CSSDeclaration[] };

function findInEffect(
    earlier: readonly CSSBlock[],
    block: CSSBlockInput,
): Map<string, CSSDeclaration> {
    const inEffect = new Map<string, CSSDeclaration>();
    for (const each of earlier) {
        if (!covers(each, block)) continue;
        for (const line of each.declarations) inEffect.set(line.name, line);
    }
    return inEffect;
}

function findValuesThatMightApply(
    earlier: readonly CSSBlock[],
    block: CSSBlockInput,
): Map<string, Set<string>> {
    const valuesByName = new Map<string, Set<string>>();
    for (const each of earlier) {
        if (covers(each, block)) continue;
        for (const { name, value } of each.ruleDeclarations) {
            const values = valuesByName.get(name);
            if (values) values.add(value);
            else valuesByName.set(name, new Set([value]));
        }
    }
    return valuesByName;
}

function chooseRuleDeclarations(
    block: BlockWithDeclarations,
    inEffect: Map<string, CSSDeclaration>,
    valuesThatMightApply: Map<string, Set<string>>,
    isSetByThisBlock: (token: Token) => boolean,
): CSSDeclaration[] {
    const all = block.declarations;
    const changed = all.filter((line) =>
        needsDeclaring(line, inEffect, valuesThatMightApply, isSetByThisBlock),
    );
    if (block.redeclare === false) return changed;
    return [...changed, ...findDependents(all, changed)];
}

function needsDeclaring(
    line: CSSDeclaration,
    inEffect: Map<string, CSSDeclaration>,
    valuesThatMightApply: Map<string, Set<string>>,
    isSetByThisBlock: (token: Token) => boolean,
): boolean {
    if (hasChanged(inEffect.get(line.name), line)) return true;
    if (!isSetByThisBlock(line.token)) return false;
    return hasConflictingValue(valuesThatMightApply.get(line.name), line.value);
}

function chooseSupportsDeclarations(
    block: BlockWithDeclarations,
    ruleDeclarations: readonly CSSDeclaration[],
    inEffect: Map<string, CSSDeclaration>,
): CSSDeclaration[] {
    const declared = new Set(ruleDeclarations.map(({ name }) => name));
    return block.declarations.filter((line) => needsSupports(line, declared, inEffect));
}

function needsSupports(
    line: CSSDeclaration,
    declared: Set<string>,
    inEffect: Map<string, CSSDeclaration>,
): boolean {
    if (line.supports === undefined) return false;
    if (declared.has(line.name)) return true;
    return !sameSupports(inEffect.get(line.name)?.supports, line.supports);
}

function covers(earlier: CSSBlockInput, later: CSSBlockInput): boolean {
    const reach = [earlier.selector].flat();
    const target = [later.selector].flat();
    const everyElement = reach.includes(":root") || target.every((each) => reach.includes(each));
    return everyElement && coversAtRules(earlier.atRules ?? [], later.atRules ?? []);
}

function coversAtRules(earlier: readonly string[], later: readonly string[]): boolean {
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

function createSetByThisBlockCheck(
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

function hasConflictingValue(values: Set<string> | undefined, value: string): boolean {
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

function findDependents(
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
    const affected = new Set<string>();
    const queue = [...new Set(changed.map(({ token }) => token.path))];
    for (const path of queue) {
        for (const { token } of users.get(path) ?? []) {
            if (affected.has(token.path)) continue;
            affected.add(token.path);
            queue.push(token.path);
        }
    }
    const changedNames = new Set(changed.map(({ name }) => name));
    return all.filter(({ name, token }) => affected.has(token.path) && !changedNames.has(name));
}
