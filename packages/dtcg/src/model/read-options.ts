import type { ExtensionValidator, Generator } from "./extension.js";
import type { ParseOptions } from "./parse.js";
import type { Input } from "./permutation.js";

/** How to read design tokens. */
export interface ReadOptions extends ParseOptions {
    /**
     * Which permutations to build.
     *
     * `"all"` builds every combination of contexts. `"each-context"` builds each context once, with
     * the other modifiers at their defaults. An array builds the permutations its inputs name. An
     * input that doesn't fit the resolver is reported, and not built.
     *
     * @default "all"
     *
     * @example
     * // Only dark
     * (await read("tokens.resolver.json", { inputs: [{ mode: "dark" }] })).permutations.label
     * // => "mode: dark"
     */
    inputs?: readonly Input[] | "all" | "each-context";
    /**
     * The most combinations `"all"` builds.
     *
     * Above it, `"each-context"` is built instead, with a `permutation-limit` warning.
     *
     * @default 32
     */
    permutationLimit?: number;
    /**
     * Checks for your own `$extensions` keys, such as one from {@link defineExtensionValidator}.
     */
    extensionValidators?: readonly ExtensionValidator[];
    /**
     * Generators that add tokens from extensions on groups, such as one from
     * {@link defineGenerator}.
     *
     * They run in order.
     */
    generators?: readonly Generator[];
    /**
     * Called as each stage of reading finishes, with how long it took in milliseconds.
     *
     * The stages, in order:
     *
     * - `"load"`: reading the entry file, the resolver and every file it lists.
     * - `"generate"`: running {@link ReadOptions.generators | generators}.
     * - `"merge"`: combining each permutation's files into one set of tokens, not counting
     *   generating.
     * - `"build"`: resolving every value and making the tokens and groups.
     * - `"validate-extensions"`: running
     *   {@link ReadOptions.extensionValidators | extension validators}.
     */
    onStage?: (
        stage: "load" | "generate" | "merge" | "build" | "validate-extensions",
        milliseconds: number,
    ) => void;
}

/**
 * Returns a file's text, or `undefined` if it isn't there.
 *
 * `path` is where to fetch the file, such as `"tokens/dark.json"`. `file` is the name the results
 * use, such as `"dark.json"`. If it throws, the read rejects.
 *
 * @example
 * // Read from disk, and keep each file's text by its name
 * const texts = new Map<string, string>();
 * const tokens = await read("tokens/tokens.resolver.json", {
 *     readText: async (path, file) => {
 *         const text = await readFile(path, "utf8");
 *         texts.set(file, text);
 *         return text;
 *     },
 * });
 */
export type ReadText = (path: string, file: string) => Promise<string | undefined>;

/**
 * Design tokens as text, each file's by its name.
 *
 * {@link readFromMemory} takes it, and {@link DesignTokens.toMemory} returns it.
 */
export interface TokensInMemory {
    /** Each file's text by its name, such as `{ "color.json": text }`. */
    readonly files: Readonly<Record<string, string>>;
    /**
     * The file to start from, such as `"tokens.resolver.json"`.
     *
     * @default the one resolver among the files, or else the only file
     */
    readonly entryFile?: string | undefined;
}
