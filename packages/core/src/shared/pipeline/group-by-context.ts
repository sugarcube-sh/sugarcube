import type { NormalizedTokens } from "../../types/normalize.js";
import type { ResolvedTokens } from "../../types/resolve.js";
import type { TokenTree } from "../../types/tokens.js";

/**
 * Organizes resolved tokens by context into a `Record<context, tokens>` lookup map.
 *
 * Every token lands in the bucket named by its `$source.context` (or the
 * owning tree's `context` for metadata nodes with no `$source`). Trees without
 * a context land in the `"default"` bucket.
 *
 * Example:
 *
 *     groupByContext(
 *         [{ context: undefined, ... }, { context: "dark", ... }],
 *         {
 *             "color.primary": { $value: "#000", $source: { ... } },
 *             "color.primary": { $value: "#fff", $source: { context: "dark" } },
 *             "spacing.small": { $value: "8px", $source: { ... } },
 *         }
 *     )
 *     // =>
 *     // {
 *     //   default: {
 *     //     "color.primary": { $value: "#000", ... },
 *     //     "spacing.small":  { $value: "8px", ... },
 *     //   },
 *     //   dark: {
 *     //     "color.primary": { $value: "#fff", ... },
 *     //   },
 *     // }
 */
export function groupByContext(trees: TokenTree[], resolved: ResolvedTokens): NormalizedTokens {
    const result: NormalizedTokens = {};

    for (const tree of trees) {
        const contextName = tree.context ?? "default";
        if (!result[contextName]) result[contextName] = {};
    }

    for (const [path, node] of Object.entries(resolved)) {
        if (!("$source" in node)) {
            for (const tree of trees) {
                const contextName = tree.context ?? "default";
                let bucket = result[contextName];
                if (!bucket) {
                    bucket = {};
                    result[contextName] = bucket;
                }
                bucket[path] = node;
            }
            continue;
        }

        const contextName = node.$source.context ?? "default";
        let bucket = result[contextName];
        if (!bucket) {
            bucket = {};
            result[contextName] = bucket;
        }
        bucket[path] = node;
    }

    return result;
}
