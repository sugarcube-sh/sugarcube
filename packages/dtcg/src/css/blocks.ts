import type { DesignTokens, Input, Permutation, ResolverModifier, Token } from "../index.js";
import { findByName } from "../read/input.js";
import { stacksOn } from "./stacks-on.js";
import { type CSSDeclaration, type CSSWriter, cssWriter } from "./writer.js";

/** A block of custom properties: the theme it is for, its selector, and the at-rules around it. */
export interface CSSBlockInput {
    /**
     * The input the block is for, such as `{ mode: "dark" }`: its declarations are that
     * permutation's, and where its selector matches, the modifiers it names are set while the
     * others are left to the blocks under it. It writes every token any context of those
     * modifiers provides a value for (Resolver 2.1) whenever an earlier block that might also
     * apply writes something else, so dark and a brand can apply to one element at once, and a
     * `{ mode: "light" }` section inside a dark page is light. An input naming every modifier
     * makes the block stand alone: it is the whole of its permutation.
     */
    readonly input: Input;
    readonly selector: string | readonly string[];
    /** Outermost first, such as `["@media (min-width: 640px)"]`. */
    readonly atRules?: readonly string[];
    /**
     * Whether the block writes again every declaration referring to something it changes, so an
     * element anywhere under its selector gets the right values. `false` suits a block that can
     * only match the root element, which nothing above it inherits from.
     * @default true
     */
    readonly redeclare?: boolean;
}

/** A block, with what it must write. */
export interface CSSBlock extends CSSBlockInput {
    /** Every declaration of the permutation its input names, as the writer gives them. */
    readonly declarations: readonly CSSDeclaration[];
    /** The declarations written in its rule. */
    readonly inRule: readonly CSSDeclaration[];
    /** The declarations whose `supports` alternatives it writes, under `@supports`. */
    readonly underSupports: readonly CSSDeclaration[];
}

/**
 * What each block must write, in order, each for the permutation its input names, with its
 * declarations from `writer` (a writer with no options when none is given). A declaration is
 * written when its value differs from the earlier blocks that surely apply wherever it does, or
 * when a context of a modifier the block decides provides a value for its token (see
 * {@link CSSBlockInput.input}) and an earlier block that might also apply writes another value for
 * it. Then, unless the block says `redeclare: false`, every declaration referring to what it
 * writes, through every step, since a variable referring to another is worked out where it is
 * declared. An earlier block surely applies when it applies to every element and every screen the
 * later one does: its selectors include `:root` or all of the later block's, and it has no
 * at-rules, the same ones, or a width query every screen the later one matches also matches. Any
 * other earlier block might apply. When two blocks with equally specific selectors both apply,
 * the later one in the list wins, so blocks that stack are listed in the resolver's order. Throws
 * the read's `PermutationError` for an input naming a permutation the tokens don't have.
 *
 * @example
 * const css = cssText(
 *     cssBlocks(tokens, [
 *         { input: {}, selector: ":root" },
 *         { input: { mode: "dark" }, selector: '[data-mode="dark"]' },
 *         { input: { brand: "ocean" }, selector: '[data-brand="ocean"]' },
 *     ]),
 * );
 *
 * @example
 * // every combination listed, each block standing alone
 * cssBlocks(tokens, [
 *     { input: { mode: "light", brand: "house" }, selector: ":root" },
 *     { input: { mode: "dark", brand: "house" }, selector: '[data-mode="dark"]' },
 * ], { writer: cssWriter({ naming: { prefix: "ds" } }) });
 */
export function cssBlocks(
    tokens: DesignTokens,
    blocks: readonly CSSBlockInput[],
    { writer = cssWriter() }: { writer?: CSSWriter } = {},
): CSSBlock[] {
    const found = blocks.map((each) => {
        const permutation = tokens.permutation(each.input);
        return {
            ...each,
            permutation,
            declarations: writer.declarations(permutation).declarations,
        };
    });
    const provided = providedBy(found);
    const made: CSSBlock[] = [];
    for (const { permutation, ...block } of found) {
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
        const own = ownership(block.input, permutation, provided);
        const all = block.declarations;
        const changed = all.filter(
            (line) =>
                changedFrom(inEffect.get(line.name), line) ||
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
    return earlier.length === 1 && later.length === 1 && stacksOn(earlier[0], later[0]);
}

function providedBy(
    blocks: readonly { declarations: readonly CSSDeclaration[] }[],
): Map<ResolverModifier, Set<string>> {
    const provided = new Map<ResolverModifier, Set<string>>();
    for (const { declarations } of blocks) {
        for (const { token } of declarations) {
            for (const { source } of token.writtenAt) {
                const { modifier } = source;
                if (!modifier) continue;
                const paths = provided.get(modifier);
                if (paths) paths.add(token.path);
                else provided.set(modifier, new Set([token.path]));
            }
        }
    }
    return provided;
}

function ownership(
    input: Input,
    permutation: Permutation,
    provided: Map<ResolverModifier, Set<string>>,
): (token: Token) => boolean {
    const named = Object.keys(input);
    const decided = permutation.contexts
        .map(({ modifier }) => modifier)
        .filter(({ name }) => findByName(named, name, (each) => each) !== undefined);
    if (decided.length === permutation.contexts.length) return () => true;
    const paths = decided.flatMap((modifier) => {
        const found = provided.get(modifier);
        return found ? [found] : [];
    });
    return ({ path }) => paths.some((each) => each.has(path));
}

function disputed(values: Set<string> | undefined, value: string): boolean {
    if (!values) return false;
    for (const each of values) if (each !== value) return true;
    return false;
}

function changedFrom(earlier: CSSDeclaration | undefined, line: CSSDeclaration): boolean {
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
        for (const { path } of line.refersTo) {
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
