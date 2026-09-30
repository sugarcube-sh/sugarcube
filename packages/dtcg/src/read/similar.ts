export function similarName<T extends string>(
    wanted: string,
    candidates: readonly T[],
): T | undefined {
    const scored = candidates.map((name) => ({
        name,
        distance: editDistance(wanted.toLowerCase(), name.toLowerCase()),
    }));
    const closest = Math.min(...scored.map(({ distance }) => distance));
    const limit = Math.max(1, Math.min(2, Math.floor(wanted.length / 3)));
    const [only, ...others] = scored.filter(({ distance }) => distance === closest);
    return closest <= limit && others.length === 0 ? only?.name : undefined;
}

function editDistance(a: string, b: string): number {
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (const [i, fromA] of [...a].entries()) {
        const current = [i + 1];
        for (const [j, fromB] of [...b].entries()) {
            const replace = (previous[j] ?? 0) + (fromA === fromB ? 0 : 1);
            current.push(Math.min((previous[j + 1] ?? 0) + 1, (current[j] ?? 0) + 1, replace));
        }
        previous = current;
    }
    return previous[b.length] ?? 0;
}
