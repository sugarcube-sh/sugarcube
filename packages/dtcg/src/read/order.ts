import type { Merged, Written } from "./merge.js";

export type Prefixes = Map<string, string[]>;

export function inWrittenOrder(merged: Merged, prefixes: Prefixes): void {
    const byPlace = (a: string, b: string) => {
        const ofA = prefixesOf(a, prefixes);
        const ofB = prefixesOf(b, prefixes);
        let depth = 0;
        while (depth < ofA.length && ofA[depth] === ofB[depth]) depth++;
        const [first, second] = [ofA[depth], ofB[depth]];
        if (first === undefined || second === undefined) return ofA.length - ofB.length;
        return compare(merged.written.get(first), merged.written.get(second));
    };
    merged.tokens = sorted(merged.tokens, byPlace);
    merged.groups = sorted(merged.groups, byPlace);
}

function sorted<T>(map: Map<string, T>, byPlace: (a: string, b: string) => number): Map<string, T> {
    let before: string | undefined;
    for (const path of map.keys()) {
        if (before !== undefined && byPlace(before, path) > 0) {
            return new Map([...map].sort(([a], [b]) => byPlace(a, b)));
        }
        before = path;
    }
    return map;
}

function compare(a: Written | undefined, b: Written | undefined): number {
    if (!a || !b) return (a ? -1 : 0) + (b ? 1 : 0);
    return a.order - b.order || a.offset - b.offset;
}

function prefixesOf(path: string, prefixes: Prefixes): string[] {
    const known = prefixes.get(path);
    if (known) return known;
    const names = path.split(".");
    const found = names.map((_, depth) => names.slice(0, depth + 1).join("."));
    prefixes.set(path, found);
    return found;
}
