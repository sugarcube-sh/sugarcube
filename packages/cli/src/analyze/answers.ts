import { type Token, dependencies, group } from "@sugarcube-sh/dtcg";
import { describeElidedParents, hopsTo, parentsOf } from "./reach.js";
import type { System } from "./system.js";
import type { Use, Uses } from "./uses.js";

export interface Analysis {
    system: System;
    uses: Uses;
}

export interface Unused {
    unused: string[];
    total: number;
}

export interface Dependent {
    path: string;
    references: string[];
    inDefault?: string;
    label?: string;
}

export interface Impact {
    token: Token;
    dependents: Dependent[];
    uses: Use[];
}

export function unused({ system, uses }: Analysis): Unused {
    const used = [...new Set(uses.uses.map(({ token }) => token))];
    const reached = new Set(used);
    for (const permutation of system.permutations) {
        for (const each of dependencies(permutation, used, { transitive: true })) {
            reached.add(each.path);
        }
    }
    const left = [...system.tokens.keys()].filter((path) => !reached.has(path)).sort();
    return { unused: left, total: system.tokens.size };
}

export function tokenAt(system: System, path: string): Token | "group" | undefined {
    const found = system.tokens.get(path);
    if (found) return found;
    return system.permutations.some((permutation) => group(permutation, path))
        ? "group"
        : undefined;
}

export function impact({ system, uses }: Analysis, token: Token): Impact {
    const { path } = token;
    const hops = hopsTo(system.permutations, path);
    const labels = describeElidedParents(hops, system);
    const inDefault = new Map<string, string>();
    const { defaultPermutation } = system;
    for (const hop of hops) {
        if (defaultPermutation && hop.in.includes(defaultPermutation)) {
            inDefault.set(hop.from, hop.to);
        }
    }
    const dependents = [...parentsOf(hops)]
        .map(([dependent, references]) => {
            const each: Dependent = { path: dependent, references: [...references].sort() };
            const preferred = inDefault.get(dependent);
            const label = labels.get(dependent);
            if (preferred) each.inDefault = preferred;
            if (label) each.label = label;
            return each;
        })
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const affected = new Set([path, ...dependents.map((each) => each.path)]);
    return { token, dependents, uses: uses.uses.filter((each) => affected.has(each.token)) };
}
