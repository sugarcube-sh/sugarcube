import { type Permutation, referrers, token } from "@sugarcube-sh/dtcg";
import type { System } from "./system.js";

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

export function describeElidedParents(
    hops: Hop[],
    { permutations, defaultPermutation }: Pick<System, "permutations" | "defaultPermutation">,
): Map<string, string> {
    const described = new Map<string, string>();
    const base = defaultPermutation ?? permutations[0];
    if (!base) return described;

    for (const [dependent, parents] of parentsOf(hops)) {
        if (parents.length < 2) continue;

        const parentsIn = (permutation: Permutation) =>
            hops
                .filter((hop) => hop.from === dependent && hop.in.includes(permutation))
                .map(({ to }) => to)
                .sort()
                .join("\0");
        const before = parentsIn(base);
        const changed = permutations.filter((each) => parentsIn(each) !== before);
        const setBy = new Set(changed.flatMap((each) => modifierSetting(each, dependent)));

        if (changed.length === 0) {
            described.set(dependent, `${parents.length} references`);
        } else if (setBy.size === 1) {
            described.set(dependent, `per ${[...setBy][0]}`);
        } else {
            described.set(dependent, "per context");
        }
    }

    return described;
}

function modifierSetting(permutation: Permutation, path: string): string[] {
    const found = token(permutation, path);
    const from = found && permutation.sources[found.source.index]?.from;
    return from && "modifier" in from ? [from.modifier] : [];
}
