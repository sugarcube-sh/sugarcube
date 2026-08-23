import type { ColorScaleConfig, ResolvedTokens } from "@sugarcube-sh/core/client";
import { convertColorToString } from "@sugarcube-sh/core/client";
import type { PathIndex } from "./path-index";
import { lastSegment, resolveTerminalPath } from "./paths";

export type DiscoveredStep = {
    step: string;
    path: string;
};

export function discoverPaletteSteps(pathIndex: PathIndex, palette: string): DiscoveredStep[] {
    const depth = palette.split(".").length + 1;

    const children = pathIndex
        .under(palette)
        .filter((path) => path.split(".").length === depth)
        .map((path) => ({ step: lastSegment(path), path }));

    if (children.length > 0) return children;

    const exists = pathIndex.matching(palette).length > 0;
    return exists ? [{ step: lastSegment(palette), path: palette }] : [];
}

export type PaletteRampContext = {
    pathIndex: PathIndex;
    resolved: ResolvedTokens;
    context: string;
};

export type PaletteRamp = {
    path: string;
    name: string;
    steps: { step: string; value: string; css: string | undefined }[];
};

function paintedColor(path: string, ctx: PaletteRampContext): string | undefined {
    const read = (p: string) => ctx.pathIndex.readValue(ctx.resolved, p, ctx.context);
    const value = read(resolveTerminalPath(path, read));
    if (value === undefined || value === null) return undefined;

    const result = convertColorToString(value as Parameters<typeof convertColorToString>[0]);
    return result.success ? result.value : undefined;
}

export function paletteRamps(
    scale: ColorScaleConfig,
    ctx: PaletteRampContext,
    scope?: { palettes?: readonly string[]; steps?: readonly string[] },
): PaletteRamp[] {
    const palettes = scope?.palettes ?? scale.palettes;
    const allowed = scope?.steps ?? scale.steps;

    return palettes.map((palette) => {
        const discovered = new Map(
            discoverPaletteSteps(ctx.pathIndex, palette).map((s) => [s.step, s.path]),
        );
        const order = allowed ?? [...discovered.keys()];

        return {
            path: palette,
            name: lastSegment(palette),
            steps: order.flatMap((step) => {
                const path = discovered.get(step);
                if (!path) return [];
                return [{ step, value: path, css: paintedColor(path, ctx) }];
            }),
        };
    });
}
