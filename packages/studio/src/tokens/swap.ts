import type { PathIndex } from "./path-index";
import { lastSegment, parentPath, unwrapRef, wrapRef } from "./paths";
import type { TokenReader, TokenUpdate } from "./types";

export type TypeReader = (path: string, context?: string) => string | undefined;

export type ReferencedGroup = {
    group: string;
    shades: string[];
    count: number;
};

export function referencedGroups(
    family: string,
    readToken: TokenReader,
    pathIndex: PathIndex,
    contexts: readonly string[],
): ReferencedGroup[] {
    const byGroup = new Map<string, { shades: string[]; paths: Set<string> }>();

    for (const path of pathIndex.under(family)) {
        for (const context of contexts) {
            const ref = unwrapRef(readToken(path, context));
            if (!ref) continue;

            const group = parentPath(ref);
            if (!group) continue;

            const shade = lastSegment(ref);
            const entry = byGroup.get(group);
            if (!entry) {
                byGroup.set(group, { shades: [shade], paths: new Set([path]) });
            } else {
                if (!entry.shades.includes(shade)) entry.shades.push(shade);
                entry.paths.add(path);
            }
        }
    }

    return Array.from(byGroup, ([group, { shades, paths }]) => ({
        group,
        shades,
        count: paths.size,
    }));
}

function allGroups(pathIndex: PathIndex): string[] {
    const groups = new Set<string>();
    for (const [path] of pathIndex.entries()) {
        const parent = parentPath(path);
        if (parent) groups.add(parent);
    }
    return Array.from(groups);
}

export function swapCandidates(
    shades: readonly string[],
    pathIndex: PathIndex,
    readType: TypeReader,
): string[] {
    if (shades.length === 0) return [];

    return allGroups(pathIndex).filter((group) =>
        shades.every((shade) => {
            const path = `${group}.${shade}`;
            return pathIndex.entriesFor(path).length > 0 && readType(path) === "color";
        }),
    );
}

type CoveredRef = { path: string; context: string; ref: string };

function coveredRefs(
    family: string,
    baselineGroup: string,
    readCurrent: TokenReader,
    readBaseline: TokenReader,
    pathIndex: PathIndex,
    contexts: readonly string[],
): CoveredRef[] {
    const covered: CoveredRef[] = [];

    for (const path of pathIndex.under(family)) {
        for (const context of contexts) {
            const authored = unwrapRef(readBaseline(path, context));
            if (!authored || parentPath(authored) !== baselineGroup) continue;

            const ref = unwrapRef(readCurrent(path, context));
            if (!ref) continue;

            covered.push({ path, context, ref });
        }
    }

    return covered;
}

export function swapUpdates(
    family: string,
    baselineGroup: string,
    to: string,
    readCurrent: TokenReader,
    readBaseline: TokenReader,
    pathIndex: PathIndex,
    contexts: readonly string[],
): TokenUpdate[] {
    const updates: TokenUpdate[] = [];

    for (const { path, context, ref } of coveredRefs(
        family,
        baselineGroup,
        readCurrent,
        readBaseline,
        pathIndex,
        contexts,
    )) {
        const next = `${to}.${lastSegment(ref)}`;
        if (next === ref) continue;

        if (next === path) continue;

        updates.push({ path, value: wrapRef(next), context });
    }

    return updates;
}

function wouldSelfReference(
    family: string,
    baselineGroup: string,
    to: string,
    readBaseline: TokenReader,
    pathIndex: PathIndex,
    contexts: readonly string[],
): boolean {
    return coveredRefs(family, baselineGroup, readBaseline, readBaseline, pathIndex, contexts).some(
        ({ path, ref }) => `${to}.${lastSegment(ref)}` === path,
    );
}

export function currentSwapGroup(
    family: string,
    baselineGroup: string,
    readCurrent: TokenReader,
    readBaseline: TokenReader,
    pathIndex: PathIndex,
    contexts: readonly string[],
): string | undefined {
    let found: string | undefined;

    for (const path of pathIndex.under(family)) {
        for (const context of contexts) {
            const authored = unwrapRef(readBaseline(path, context));
            if (!authored || parentPath(authored) !== baselineGroup) continue;

            const current = unwrapRef(readCurrent(path, context));
            const group = current ? parentPath(current) : undefined;
            if (!group) continue;

            if (found === undefined) found = group;
            else if (found !== group) return undefined;
        }
    }

    return found;
}

export type SwapRow = {
    current: string;
    shades: string[];
    candidates: string[];
};

export function swapRowFor(
    family: string,
    readToken: TokenReader,
    readType: TypeReader,
    pathIndex: PathIndex,
    contexts: readonly string[],
): SwapRow | undefined {
    const rows = referencedGroups(family, readToken, pathIndex, contexts).flatMap(
        ({ group, shades, count }) => {
            const candidates = swapCandidates(shades, pathIndex, readType).filter(
                (candidate) =>
                    candidate === group ||
                    !wouldSelfReference(family, group, candidate, readToken, pathIndex, contexts),
            );

            if (candidates.length < 2) return [];
            return [{ row: { current: group, shades, candidates }, count }];
        },
    );

    if (rows.length !== 1) return undefined;

    const only = rows[0];
    return only && only.count >= 2 ? only.row : undefined;
}
