// Way to check if two sets of keys are the same.
export function sameKeySet(a: IterableIterator<string>, b: readonly string[]): boolean {
    const aSet = new Set(a);
    if (aSet.size !== b.length) return false;
    for (const key of b) {
        if (!aSet.has(key)) return false;
    }
    return true;
}
