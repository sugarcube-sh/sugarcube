export function similarName<T extends string>(
    wanted: string,
    candidates: readonly T[],
): T | undefined {
    let closest = Number.POSITIVE_INFINITY;
    let best: T | undefined;
    let tied = false;
    for (const name of candidates) {
        const [target, candidate] = differing(wanted.toLowerCase(), name.toLowerCase());
        const limit = Math.max(1, Math.min(2, Math.floor(target.length / 3)));
        if (Math.abs(candidate.length - target.length) > limit) continue;
        const distance = editDistance(target, candidate, limit);
        if (distance > limit) continue;
        if (distance < closest) {
            closest = distance;
            best = name;
            tied = false;
        } else if (distance === closest) {
            tied = true;
        }
    }
    return tied ? undefined : best;
}

function differing(wanted: string, name: string): [string[], string[]] {
    const [from, to] = [wanted.split("."), name.split(".")];
    let shared = 0;
    while (shared < from.length - 1 && shared < to.length - 1 && from[shared] === to[shared]) {
        shared++;
    }
    return [[...from.slice(shared).join(".")], [...to.slice(shared).join(".")]];
}

function editDistance(a: string[], b: string[], limit: number): number {
    let beforePrevious: number[] = [];
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (const [i, fromA] of a.entries()) {
        const current = [i + 1];
        let smallest = i + 1;
        for (const [j, fromB] of b.entries()) {
            const replace = (previous[j] ?? 0) + (fromA === fromB ? 0 : 1);
            let distance = Math.min((previous[j + 1] ?? 0) + 1, (current[j] ?? 0) + 1, replace);
            if (i > 0 && j > 0 && fromA === b[j - 1] && a[i - 1] === fromB) {
                distance = Math.min(distance, (beforePrevious[j - 1] ?? 0) + 1);
            }
            current.push(distance);
            smallest = Math.min(smallest, distance);
        }
        if (smallest > limit) return limit + 1;
        beforePrevious = previous;
        previous = current;
    }
    return previous[b.length] ?? 0;
}
