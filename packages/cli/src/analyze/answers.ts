import {
    type DesignTokens,
    type Permutations,
    type ResolverContext,
    type Source,
    type Token,
    everyPermutation,
} from "@sugarcube-sh/dtcg";
import type { Use, Uses } from "./uses.js";

export interface Analysis {
    tokens: DesignTokens;
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

export interface Written {
    token: Token;
    file: string;
    permutations: Permutations;
}

export interface Impact {
    path: string;
    written: Written[];
    dependents: Dependent[];
    uses: Use[];
}

export function unused({ tokens, uses }: Analysis): Unused {
    const used = uses.uses.map(({ token }) => token);
    const reached = new Set(used);
    for (const permutation of tokens.permutations) {
        for (const path of used) {
            for (const { path: named } of permutation.refersTo(path, { chained: true })) {
                if (named !== undefined) reached.add(named);
            }
        }
    }
    const paths = tokens.tokenPaths();
    return { unused: paths.filter((path) => !reached.has(path)).sort(), total: paths.length };
}

export function writtenOf(tokens: DesignTokens, path: string): Written[] | "group" | undefined {
    const written = tokens.writtenAt(path).flatMap(({ span, winsIn }) => {
        const token = winsIn[0]?.token(path);
        return token ? [{ token, file: span.file, permutations: winsIn }] : [];
    });
    if (written.length > 0) return written;
    return tokens.has(path) ? "group" : undefined;
}

interface Named {
    path: string;
    permutations: Permutations;
}

export function impact({ tokens, uses }: Analysis, path: string, written: Written[]): Impact {
    const byDependent = new Map<string, Named[]>();
    const asked = everyPermutation(tokens, (p) => p.referencedBy(path, { chained: true }));
    for (const { answer, permutations } of asked) {
        for (const reference of answer) {
            const from = reference.from.path;
            if (from === path || reference.path === undefined) continue;
            const named = { path: reference.path, permutations };
            byDependent.set(from, [...(byDependent.get(from) ?? []), named]);
        }
    }
    const dependents = [...byDependent]
        .map(([from, references]) => dependent(tokens, from, references))
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const affected = new Set([path, ...byDependent.keys()]);
    return {
        path,
        written,
        dependents,
        uses: uses.uses.filter((each) => affected.has(each.token)),
    };
}

function dependent(tokens: DesignTokens, path: string, references: Named[]): Dependent {
    const paths = (named: Named[]) => [...new Set(named.map((each) => each.path))].sort();
    const found: Dependent = { path, references: paths(references) };
    const defaultTheme = tokens.permutations.find((each) => each.isDefault);
    const [inDefault] = defaultTheme
        ? paths(references.filter(({ permutations }) => permutations.includes(defaultTheme)))
        : [];
    if (inDefault) found.inDefault = inDefault;
    if (found.references.length < 2) return found;

    const namedIn = (permutations: Permutations) =>
        paths(references.filter((each) => permutations.some((p) => each.permutations.includes(p))));
    const places = tokens
        .writtenAt(path)
        .filter(({ winsIn }) => winsIn.length > 0)
        .map(({ sources, winsIn }) => ({ sources, named: namedIn(winsIn).join("\0") }));
    const base = new Set(
        places.filter(({ sources }) => sources.some(readByEveryone)).map(({ named }) => named),
    );
    const varies = new Set(places.map(({ named }) => named)).size > 1;
    const setBy = new Set(
        places
            .filter(({ named }) => varies && !base.has(named))
            .flatMap(({ sources }) => sources.flatMap(readersOf))
            .map(({ modifier }) => modifier.name),
    );
    const [only] = setBy;
    if (only === undefined) found.label = `${found.references.length} references`;
    else if (setBy.size === 1) found.label = `per ${only}`;
    else found.label = "per context";
    return found;
}

function readByEveryone({ readBy }: Source): boolean {
    return readBy === "everyone";
}

function readersOf({ readBy }: Source): readonly ResolverContext[] {
    return readBy === "everyone" ? [] : readBy;
}
