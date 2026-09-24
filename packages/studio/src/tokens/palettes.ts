import type { ColorScaleConfig, ResolvedTokens } from "@sugarcube-sh/core/client";
import type { PathIndex } from "./path-index";
import { cssColorFor } from "./color-value";
import { lastSegment, parentPath, stepLabel } from "./paths";
import { isAlias } from "./sections";

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
    return cssColorFor(path, (p) => ctx.pathIndex.readValue(ctx.resolved, p, ctx.context));
}

export function documentRamps(ctx: PaletteRampContext): PaletteRamp[] {
    const byParent = new Map<string, string[]>();

    for (const [path] of ctx.pathIndex.entries()) {
        const parent = parentPath(path);
        if (!parent) continue;

        const token = ctx.pathIndex.readToken(ctx.resolved, path, ctx.context);
        if (!token || token.$type !== "color" || isAlias(token)) continue;

        const siblings = byParent.get(parent);
        if (siblings) siblings.push(path);
        else byParent.set(parent, [path]);
    }

    return Array.from(byParent, ([parent, paths]) => ({
        path: parent,
        name: parent,
        steps: paths.map((path) => ({
            step: stepLabel(path),
            value: path,
            css: paintedColor(path, ctx),
        })),
    }));
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
