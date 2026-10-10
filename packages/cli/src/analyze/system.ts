import { type Permutation, type Token, defaultPermutation, dependencies } from "@sugarcube-sh/dtcg";
import type { Built } from "../build.js";
import { type VarRef, scanCSS } from "../lint/scan-css.js";

export const UTILITY_SOURCE = "<utilities>";

export interface System {
    permutations: Permutation[];
    tokens: Map<string, Token>;
    variables: Map<string, string>;
    defaultPermutation?: Permutation;
}

export function systemOf({ doc, declared }: Built): System {
    const permutations = [...new Set(declared.entries.map(({ permutation }) => permutation))];
    const tokens = new Map<string, Token>();
    for (const permutation of permutations) {
        for (const each of permutation.tokens) {
            if (!tokens.has(each.path)) tokens.set(each.path, each);
        }
    }
    const variables = new Map<string, string>();
    for (const { declared: made } of declared.entries) {
        for (const { name, token } of made.declarations) variables.set(name, token.path);
    }
    const fallback = defaultPermutation(doc);
    return {
        permutations,
        tokens,
        variables,
        ...(fallback && permutations.includes(fallback) && { defaultPermutation: fallback }),
    };
}

export function lookupToken(system: System, varName: string): string | undefined {
    return system.variables.get(varName);
}

export function usageRoots(system: System, used: VarRef[]): Set<string> {
    const roots = new Set<string>();
    for (const ref of used) {
        const path = lookupToken(system, ref.name);
        if (path) roots.add(path);
    }
    return roots;
}

export function unusedTokens(system: System, roots: Set<string>): string[] {
    const reached = new Set(roots);
    for (const permutation of system.permutations) {
        for (const each of dependencies(permutation, [...roots], { transitive: true })) {
            reached.add(each.path);
        }
    }
    return [...system.tokens.keys()].filter((path) => !reached.has(path)).sort();
}

export function utilityRefs({ utilities }: Built): VarRef[] {
    return utilities.flatMap(({ css }) => scanCSS(css, UTILITY_SOURCE).used);
}
