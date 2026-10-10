import { type Permutation, referrers } from "@sugarcube-sh/dtcg";

export interface Hop {
    from: string;
    to: string;
    in: Permutation[];
}

export function hopsTo(permutations: Permutation[], target: string): Hop[] {
    const found = new Map<string, Hop>();
    for (const permutation of permutations) {
        const reached = new Set(
            referrers(permutation, target, { transitive: true }).map(({ path }) => path),
        );
        for (const { from, to } of permutation.edges) {
            if (!reached.has(from) || !(reached.has(to) || to === target)) continue;
            const key = `${from}\0${to}`;
            const hop = found.get(key) ?? { from, to, in: [] };
            if (!hop.in.includes(permutation)) hop.in.push(permutation);
            found.set(key, hop);
        }
    }
    return [...found.values()];
}

export function parentsOf(hops: Hop[]): Map<string, string[]> {
    const parents = new Map<string, string[]>();
    for (const { from, to } of hops) parents.set(from, [...(parents.get(from) ?? []), to]);
    return parents;
}

export function defaultContextParents(
    hops: Hop[],
    defaultPermutation: Permutation | undefined,
): Map<string, string> {
    const preferred = new Map<string, string>();
    if (!defaultPermutation) return preferred;
    for (const hop of hops) {
        if (hop.in.includes(defaultPermutation)) preferred.set(hop.from, hop.to);
    }
    return preferred;
}

export function chooseParents(
    parents: Map<string, string[]>,
    weight: (id: string) => number,
    preferred: Map<string, string> = new Map(),
): Map<string, string> {
    const chosen = new Map<string, string>();

    for (const [dependent, hops] of parents) {
        const fromDefault = preferred.get(dependent);
        if (fromDefault && hops.includes(fromDefault)) {
            chosen.set(dependent, fromDefault);
            continue;
        }

        const best = [...hops].sort(
            (a, b) => weight(b) - weight(a) || a.localeCompare(b),
        )[0] as string;
        chosen.set(dependent, best);
    }

    return chosen;
}

export function describeElidedParents(hops: Hop[]): Map<string, string> {
    const described = new Map<string, string>();

    for (const [dependent, parents] of parentsOf(hops)) {
        if (parents.length < 2) continue;

        const own = hops.filter(({ from }) => from === dependent);
        const deciding = partitioningModifiers(own);

        if (deciding.length === 1) {
            described.set(dependent, `per ${deciding[0]}`);
        } else if (deciding.length > 1) {
            described.set(dependent, "per context");
        } else if (contextsDiffer(own)) {
            described.set(dependent, "per context");
        } else {
            described.set(dependent, `${parents.length} references`);
        }
    }

    return described;
}

function partitioningModifiers(hops: Hop[]): string[] {
    const parentsByValue = new Map<string, Map<string, Set<string>>>();

    for (const hop of hops) {
        for (const permutation of hop.in) {
            for (const [modifier, value] of Object.entries(permutation.input)) {
                const values = parentsByValue.get(modifier) ?? new Map<string, Set<string>>();
                const reached = values.get(value) ?? new Set<string>();
                reached.add(hop.to);
                values.set(value, reached);
                parentsByValue.set(modifier, values);
            }
        }
    }

    return [...parentsByValue]
        .filter(([, values]) => {
            if (values.size < 2) return false;
            if ([...values.values()].some((parents) => parents.size !== 1)) return false;
            const landings = new Set([...values.values()].map((parents) => [...parents][0]));
            return landings.size > 1;
        })
        .map(([modifier]) => modifier);
}

function contextsDiffer(hops: Hop[]): boolean {
    const labels = (hop: Hop) =>
        hop.in
            .map(({ label }) => label)
            .sort()
            .join("\0");
    return new Set(hops.map(labels)).size > 1;
}
