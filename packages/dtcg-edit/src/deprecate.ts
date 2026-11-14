import type { DesignTokens } from "@sugarcube-sh/dtcg";
import type { OperationResult } from "./index.js";
import { setProperty } from "./property.js";

/**
 * Marks a token or group as deprecated.
 *
 * It's written where {@link setDescription} writes a description.
 *
 * @param tokens - The design tokens to edit.
 * @param path - The token or group, such as `"color.blue.300"`.
 * @param reason - What to use instead, or `true` for no message. `false` overrides its group's
 *   deprecation. `null` removes the mark.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#deprecated | Format 5.2.4, Deprecated}
 *
 * @example
 * // Point people from color.blue.300 to color.primary
 * deprecate(tokens, "color.blue.300", "Use color.primary instead").ops
 * // => [{ kind: "add", file: "color.json", jsonPath: ["color", "blue", "300", "$deprecated"],
 * //       value: "Use color.primary instead" }]
 */
export function deprecate(
    tokens: DesignTokens,
    path: string,
    reason: string | boolean | null,
): OperationResult {
    return setProperty(tokens, path, "$deprecated", reason);
}
