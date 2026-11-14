import type { DesignTokens } from "@sugarcube-sh/dtcg";
import type { OverridableContext } from "./index.js";
import { getInputContext, findContextPlacement } from "./placement.js";

/**
 * Each context the token at `path` can be given its own value for: one that doesn't write the
 * token already, with a file of its own to hold the override where no later file would hide it.
 * Each gives the `input` that {@link setValue} writes the override with, so a tool offers only
 * overrides that will be written. A modifier's default is never listed: a value for it is the
 * shared one.
 *
 * @example
 * for (const { input, label } of getOverridableContexts(tokens, "color.brand")) {
 *     offer(`Override for ${label}`, (value) => setValue(tokens, "color.brand", value, { input }));
 * }
 */
export function getOverridableContexts(
    tokens: DesignTokens,
    path: string,
): readonly OverridableContext[] {
    return (tokens.resolver?.modifiers ?? []).flatMap((modifier) =>
        modifier.contexts.flatMap((context) => {
            const input = { [modifier.name]: context.name };
            const chosen = getInputContext(tokens, input);
            if (!chosen || "refusal" in chosen) return [];
            const placement = findContextPlacement(tokens, path, chosen, undefined);
            return "into" in placement || "choice" in placement
                ? [{ input, label: chosen.permutation.label }]
                : [];
        }),
    );
}
