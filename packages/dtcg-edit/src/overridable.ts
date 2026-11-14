import type { DesignTokens } from "@sugarcube-sh/dtcg";
import type { OverridableContext } from "./index.js";
import { getInputContext, findContextPlacement } from "./placement.js";

/**
 * Lists the contexts a token can have its own value in.
 *
 * They're the contexts with no override yet and a file one can go in. A modifier's default isn't included.
 *
 * @param tokens - The design tokens.
 * @param path - The token, such as `"button.background"`.
 *
 * @example
 * // dark.json doesn't write button.background yet
 * getOverridableContexts(tokens, "button.background")
 * // => [{ input: { mode: "dark" }, label: "mode: dark" }]
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
