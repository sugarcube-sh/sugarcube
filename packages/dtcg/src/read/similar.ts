export function similarName<T extends string>(
    wanted: string,
    candidates: readonly T[],
): T | undefined {
    const target = [...wanted.toLowerCase()];
    const limit = Math.max(1, Math.min(2, Math.floor(wanted.length / 3)));
    let closest = limit + 1;
    let best: T | undefined;
    let tied = false;
    for (const name of candidates) {
        const candidate = [...name.toLowerCase()];
        if (Math.abs(candidate.length - target.length) > limit) continue;
        const distance = editDistance(target, candidate, limit);
        if (distance < closest) {
            closest = distance;
            best = name;
            tied = false;
        } else if (distance === closest) {
            tied = true;
        }
    }
    return closest <= limit && !tied ? best : undefined;
}

function editDistance(a: string[], b: string[], limit: number): number {
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (const [i, fromA] of a.entries()) {
        const current = [i + 1];
        let smallest = i + 1;
        for (const [j, fromB] of b.entries()) {
            const replace = (previous[j] ?? 0) + (fromA === fromB ? 0 : 1);
            const distance = Math.min((previous[j + 1] ?? 0) + 1, (current[j] ?? 0) + 1, replace);
            current.push(distance);
            smallest = Math.min(smallest, distance);
        }
        if (smallest > limit) return limit + 1;
        previous = current;
    }
    return previous[b.length] ?? 0;
}
