import {
    type DesignTokens,
    type Permutations,
    type ResolverContext,
    type Source,
    type Token,
    groupPermutationsBy,
} from "@sugarcube-sh/dtcg";
import type { TokenUse, TokenUses } from "./uses.js";

export interface Analysis {
    tokens: DesignTokens;
    uses: TokenUses;
}

export interface Unused {
    unused: string[];
    total: number;
}

export interface Dependent {
    path: string;
    references: string[];
    defaultReference?: string;
    label?: string;
}

export interface TokenDefinition {
    token: Token;
    file: string;
    permutations: Permutations;
}

export interface Impact {
    path: string;
    definitions: TokenDefinition[];
    dependents: Dependent[];
    uses: TokenUse[];
}

export function findUnused({ tokens, uses }: Analysis): Unused {
    const used = uses.uses.map(({ token }) => token);
    const usedPaths = new Set(used);
    for (const permutation of tokens.permutations) {
        for (const path of used) {
            for (const { path: dependency } of permutation.getDependencies(path, {
                chained: true,
            })) {
                usedPaths.add(dependency);
            }
        }
    }
    const paths = tokens.getTokenPaths();
    return { unused: paths.filter((path) => !usedPaths.has(path)).sort(), total: paths.length };
}

export function findDefinitions(
    tokens: DesignTokens,
    path: string,
): TokenDefinition[] | "group" | undefined {
    const definitions = tokens.getDefinitions(path).flatMap(({ span, winningPermutations }) => {
        const token = winningPermutations[0]?.getToken(path);
        return token ? [{ token, file: span.file, permutations: winningPermutations }] : [];
    });
    if (definitions.length > 0) return definitions;
    return tokens.has(path) ? "group" : undefined;
}

interface DependentReference {
    path: string;
    permutations: Permutations;
}

export function findImpact(
    { tokens, uses }: Analysis,
    path: string,
    definitions: TokenDefinition[],
): Impact {
    const byDependent = new Map<string, DependentReference[]>();
    const groups = groupPermutationsBy(tokens, (p) => p.getReferencesTo(path, { chained: true }));
    for (const { result, permutations } of groups) {
        for (const reference of result) {
            const from = reference.owner.path;
            if (from === path || reference.pointsToPath === undefined) continue;
            const named = { path: reference.pointsToPath, permutations };
            byDependent.set(from, [...(byDependent.get(from) ?? []), named]);
        }
    }
    const dependents = [...byDependent]
        .map(([from, references]) => describeDependent(tokens, from, references))
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const affected = new Set([path, ...byDependent.keys()]);
    return {
        path,
        definitions,
        dependents,
        uses: uses.uses.filter((each) => affected.has(each.token)),
    };
}

function describeDependent(
    tokens: DesignTokens,
    path: string,
    references: DependentReference[],
): Dependent {
    const paths = (named: DependentReference[]) =>
        [...new Set(named.map((each) => each.path))].sort();
    const dependent: Dependent = { path, references: paths(references) };
    const defaultTheme = tokens.permutations.find((each) => each.isDefault);
    const [defaultReference] = defaultTheme
        ? paths(references.filter(({ permutations }) => permutations.includes(defaultTheme)))
        : [];
    if (defaultReference) dependent.defaultReference = defaultReference;
    if (dependent.references.length < 2) return dependent;

    const getReferencesIn = (permutations: Permutations) =>
        paths(references.filter((each) => permutations.some((p) => each.permutations.includes(p))));
    const definitions = tokens
        .getDefinitions(path)
        .filter(({ winningPermutations }) => winningPermutations.length > 0)
        .map(({ sources, winningPermutations }) => ({
            sources,
            named: getReferencesIn(winningPermutations).join("\0"),
        }));
    const baseReferences = new Set(
        definitions
            .filter(({ sources }) => sources.some(isInEveryContext))
            .map(({ named }) => named),
    );
    const differs = new Set(definitions.map(({ named }) => named)).size > 1;
    const modifiers = new Set(
        definitions
            .filter(({ named }) => differs && !baseReferences.has(named))
            .flatMap(({ sources }) => sources.flatMap(getContexts))
            .map(({ modifier }) => modifier.name),
    );
    const [onlyModifier] = modifiers;
    if (onlyModifier === undefined) dependent.label = `${dependent.references.length} references`;
    else if (modifiers.size === 1) dependent.label = `per ${onlyModifier}`;
    else dependent.label = "per context";
    return dependent;
}

function isInEveryContext({ contexts }: Source): boolean {
    return contexts === "every-context";
}

function getContexts({ contexts }: Source): readonly ResolverContext[] {
    return contexts === "every-context" ? [] : contexts;
}
