import type { PathIndex } from "./path-index";
import { unwrapRef } from "./paths";
import type { TokenReader, TokenUpdate } from "./types";

function paletteSegmentIndex(refPath: string, palettes: ReadonlySet<string>): number {
    const segments = refPath.split(".");
    const index = segments.findIndex((s) => palettes.has(s));
    return index === segments.length - 1 ? -1 : index;
}

export function currentPaletteFromReference(
    readToken: TokenReader,
    family: string,
    palettes: readonly string[],
    pathIndex: PathIndex,
    context?: string,
): string | undefined {
    const paletteSet = new Set(palettes);
    let found: string | undefined;

    for (const path of pathIndex.under(family)) {
        const refPath = unwrapRef(readToken(path, context));
        if (!refPath) continue;

        const index = paletteSegmentIndex(refPath, paletteSet);
        if (index === -1) continue;

        const palette = refPath.split(".")[index];
        if (found === undefined) found = palette;
        else if (found !== palette) return undefined;
    }

    return found;
}

export type PaletteResetPlan = {
    overridden: boolean;
    updates: TokenUpdate[];
};

export function familyPaletteResetUpdates(
    family: string,
    palettes: readonly string[],
    readCurrent: TokenReader,
    readBaseline: TokenReader,
    pathIndex: PathIndex,
    context?: string,
): PaletteResetPlan {
    const authored = currentPaletteFromReference(
        readBaseline,
        family,
        palettes,
        pathIndex,
        context,
    );
    const current = currentPaletteFromReference(readCurrent, family, palettes, pathIndex, context);

    if (authored === undefined || current === authored) return { overridden: false, updates: [] };

    return {
        overridden: true,
        updates: familyPaletteSwapUpdates(family, authored, palettes, readCurrent, pathIndex),
    };
}

export function familyPaletteSwapUpdates(
    family: string,
    newPalette: string,
    palettes: readonly string[],
    readToken: TokenReader,
    pathIndex: PathIndex,
): TokenUpdate[] {
    const paletteSet = new Set(palettes);
    const familyPaths = pathIndex.under(family);
    const contexts = pathIndex.contexts;
    const updates: TokenUpdate[] = [];

    for (const path of familyPaths) {
        for (const context of contexts) {
            const refPath = unwrapRef(readToken(path, context));
            if (!refPath) continue;

            const segmentIndex = paletteSegmentIndex(refPath, paletteSet);
            if (segmentIndex === -1) continue;

            const segments = refPath.split(".");
            segments[segmentIndex] = newPalette;

            updates.push({
                path,
                value: `{${segments.join(".")}}`,
                context,
            });
        }
    }

    return updates;
}
