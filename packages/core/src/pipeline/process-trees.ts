import type { ProcessedTree } from "../types/process-trees.js";
import type { ResolvedTokens } from "../types/resolve.js";
import type { TokenTree } from "../types/tokens.js";

/**
 * Organizes resolved tokens into their proper contexts.
 *
 * This function acts as a sorting mechanism that takes all your resolved tokens
 * and organizes them into the right "buckets" based on their context. For example:
 *
 * Input tokens might look like:
 * {
 *   "color.primary": { $value: "#000", $source: { } },
 *   "color.primary": { $value: "#fff", $source: { context: "dark" } },
 *   "spacing.small": { $value: "8px", $source: { } }
 * }
 *
 * And processTrees organizes these into:
 * [
 *   {
 *     tokens: {
 *       "color.primary": { $value: "#000", ... },
 *       "spacing.small": { $value: "8px", ... }
 *     }
 *   },
 *   {
 *     context: "dark",
 *     tokens: {
 *       "color.primary": { $value: "#fff", ... }
 *     }
 *   }
 * ]
 *
 * @param trees - The original token trees that define the structure
 * @param resolved - The resolved tokens to be organized
 * @returns An array of processed trees, each containing tokens for a specific context
 *
 */
export function processTrees(trees: TokenTree[], resolved: ResolvedTokens): ProcessedTree[] {
    const contextIndex = new Map<string, ResolvedTokens>();

    // Build indexes once - O(n)!
    for (const [path, node] of Object.entries(resolved)) {
        if (!("$source" in node)) {
            for (const tree of trees) {
                const contextKey = tree.context ?? "";
                if (!contextIndex.has(contextKey)) {
                    contextIndex.set(contextKey, {});
                }
                const contextTokens = contextIndex.get(contextKey);
                if (contextTokens) {
                    contextTokens[path] = node;
                }
            }
            continue;
        }

        const context = node.$source.context ?? "";

        if (!contextIndex.has(context)) {
            contextIndex.set(context, {});
        }
        const contextTokens = contextIndex.get(context);
        if (contextTokens) {
            contextTokens[path] = node;
        }
    }

    // Process trees using indexes - O(1) lookups
    return trees.map((tree) => {
        const contextKey = tree.context ?? "";
        const tokens = contextIndex.get(contextKey) || {};

        return {
            context: tree.context,
            tokens,
        };
    });
}
