/**
 * Cheap structure-change check for the PathIndex refresh guard.
 *
 * Returns true when the iterable `a` and the array `b` cover the same
 * set of keys (regardless of order). Used by `TokenStoreProvider`'s
 * baseline subscription to skip rebuilding the PathIndex when only token
 * values changed — the common case — and rebuild only when the resolved
 * map's key set actually shifted (a token added, removed, or moved).
 */
export function sameKeySet(a: IterableIterator<string>, b: readonly string[]): boolean {
    const aSet = new Set(a);
    if (aSet.size !== b.length) return false;
    for (const key of b) {
        if (!aSet.has(key)) return false;
    }
    return true;
}
