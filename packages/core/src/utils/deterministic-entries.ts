export function deterministicEntries<T>(obj: Record<string, T>): [string, T][] {
    return Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
}
