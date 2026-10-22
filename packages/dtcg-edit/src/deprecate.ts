import type { DesignTokens } from "@sugarcube-sh/dtcg";
import type { OpResult } from "./index.js";
import { propertyEdit } from "./property.js";

/**
 * Marks a token or group as deprecated, with a message saying what to use instead, or `true` for
 * none. `false` says it is not, over a deprecation it takes from the group it is inside or the
 * group it extends (Format 6.3.1, 6.4.2); `null` removes what it writes, and removing a mark that
 * isn't there changes nothing.
 *
 * Written where {@link setDescription} writes a description: a token's in every file that writes
 * the token, so every context keeps the same one, a group's in the file that writes it.
 *
 * Refused, with the reason: a path that is neither a token nor a group, a token a generator
 * makes, or a token or group there only because of `$extends`.
 *
 * @example
 * deprecate(tokens, "color.old", "Use color.primary instead")
 */
export function deprecate(
    tokens: DesignTokens,
    path: string,
    reason: string | boolean | null,
): OpResult {
    return propertyEdit(tokens, path, "$deprecated", reason);
}
