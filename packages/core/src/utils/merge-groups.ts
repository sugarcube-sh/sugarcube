import { isGroup, isToken } from "../guards/token-guards.js";
import type { TokenGroup } from "../types/dtcg.js";

/**
 * Deep merge two token groups per DTCG 2025.10 spec section 6.4.3.
 *
 * - Inheritance: all tokens/properties from base are inherited
 * - Override: local tokens/properties replace inherited ones at the same path
 * - Addition: local tokens/properties with new paths are added
 * - Complete replacement: when overriding, the entire token is replaced (not merged property-by-property)
 */
export function mergeGroups(base: TokenGroup, local: TokenGroup): TokenGroup {
    const result: TokenGroup = {};

    // Group properties: local overrides base
    if (base.$type || local.$type) result.$type = local.$type ?? base.$type;
    if (base.$description || local.$description)
        result.$description = local.$description ?? base.$description;
    if (base.$extensions || local.$extensions)
        result.$extensions = local.$extensions ?? base.$extensions;
    if (base.$root || local.$root) result.$root = local.$root ?? base.$root;

    // Start with all base entries, then apply local on top
    const allKeys = new Set([
        ...Object.keys(base).filter((k) => !k.startsWith("$")),
        ...Object.keys(local).filter((k) => !k.startsWith("$")),
    ]);

    for (const key of allKeys) {
        const baseValue = base[key];
        const localValue = local[key];

        if (!localValue) {
            result[key] = baseValue;
        } else if (!baseValue || isToken(localValue) || isToken(baseValue)) {
            result[key] = localValue;
        } else if (isGroup(localValue) && isGroup(baseValue)) {
            result[key] = mergeGroups(baseValue, localValue);
        } else {
            result[key] = localValue;
        }
    }

    return result;
}
