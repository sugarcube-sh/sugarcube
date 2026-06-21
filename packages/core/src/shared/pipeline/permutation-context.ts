/**
 * Recovers the permutation context (e.g. "perm:0") from a token's namespaced
 * lookup key by stripping its unprefixed `$path`. Returns "" for context-less
 * tokens.
 *
 * Every permutation is flattened into one shared map under namespaced keys like
 * "perm:0.color.text.link" while `$path` stays "color.text.link" — the
 * difference between the two is the context. Used by any stage that must resolve
 * a reference within the referrer's own permutation.
 *
 * Transitional: this will likely be removed once the top-secret token-model unification is complete.
 */
export function deriveContext(lookupKey: string, path: string): string {
    if (lookupKey === path) return "";
    if (lookupKey.endsWith(`.${path}`)) {
        return lookupKey.slice(0, lookupKey.length - path.length - 1);
    }
    return "";
}
