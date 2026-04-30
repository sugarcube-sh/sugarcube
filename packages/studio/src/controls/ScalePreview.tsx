import {
    type FluidConfig,
    type ResolvedToken,
    type ResolvedTokens,
    type ScaleBinding,
    type ScaleExtension,
    calculateScale,
    isResolvedToken,
} from "@sugarcube-sh/core/client";
import type { GeneratedStep } from "@sugarcube-sh/core/client";
import { usePathIndex, useSnapshot, useTokenStore } from "../store/hooks";
import type { PathIndex } from "../tokens/path-index";
import { getScaleExtension } from "../tokens/scale-extension";
import { stripTrailingGlob } from "./path-utils";

type Dim = { value: number; unit: "rem" | "px" };
type Viewport = { min: number; max: number };

type PreviewStep = {
    name: string;
    display: string;
};

type ScalePreviewProps = {
    binding: ScaleBinding;
};

const DEFAULT_VIEWPORT: Viewport = { min: 320, max: 1440 };
const ROOT_FONT_SIZE = 16;

/**
 * Read-only preview of a scale's generated steps. Handles both shapes of
 * authoring — recipes (via `calculateScale`) and hardcoded fluid tokens
 * (read directly from the snapshot). Renders the same row format either
 * way: step name + clamp() / static value.
 *
 * Interactive controls are deferred to a follow-up commit. This component
 * is the single render path for `type: "scale"` bindings.
 */
export function ScalePreview({ binding }: ScalePreviewProps) {
    const snapshot = useSnapshot();
    const pathIndex = usePathIndex();
    const resolved = useTokenStore((s) => s.resolved);
    const currentContext = useTokenStore((s) => s.currentContext);

    const parent = stripTrailingGlob(binding.token);
    const recipe = getScaleExtension(snapshot.trees, parent);
    const fluidConfig = snapshot.config.variables.transforms.fluid ?? DEFAULT_VIEWPORT;

    const steps = recipe
        ? stepsFromRecipe(recipe)
        : stepsFromTokens(binding.token, resolved, pathIndex, currentContext, fluidConfig);

    return (
        <div className="recipe-preview">
            {steps.map((step) => (
                <div className="scale-row" key={step.name}>
                    <span className="scale-label">{step.name}</span>
                    <span className="scale-value">{step.display}</span>
                </div>
            ))}
        </div>
    );
}

function stepsFromRecipe(extension: ScaleExtension): PreviewStep[] {
    return calculateScale(extension).map((step) => ({
        name: step.name,
        display: formatClamp(step.min, step.max, extension.viewport),
    }));
}

function stepsFromTokens(
    pattern: string,
    resolved: ResolvedTokens,
    pathIndex: PathIndex,
    context: string,
    fluidConfig: FluidConfig
): PreviewStep[] {
    const paths = pathIndex.matching(pattern);
    const steps: PreviewStep[] = [];

    for (const path of paths) {
        const entry = pathIndex.entriesFor(path).find((e) => e.context === context);
        const token = entry ? resolved[entry.key] : undefined;
        if (!isResolvedToken(token)) continue;

        const dims = readDimensions(token, fluidConfig);
        if (!dims) continue;

        steps.push({
            name: stepNameFromPath(path),
            display: formatClamp(dims.min, dims.max, dims.viewport),
        });
    }

    return steps;
}

function readDimensions(
    token: ResolvedToken,
    fluidConfig: FluidConfig
): { min: Dim; max: Dim; viewport: Viewport } | null {
    const value = token.$value as Dim | undefined;
    if (!value || typeof value.value !== "number") return null;

    const sugarcube = token.$extensions?.["sh.sugarcube"] as
        | { fluid?: { min?: Dim; max?: Dim; viewport?: Viewport } }
        | undefined;
    const fluid = sugarcube?.fluid;

    if (fluid?.min && fluid.max) {
        return {
            min: fluid.min,
            max: fluid.max,
            viewport: fluid.viewport ?? fluidConfig,
        };
    }

    return { min: value, max: value, viewport: fluidConfig };
}

function stepNameFromPath(path: string): string {
    const last = path.split(".").pop();
    return last ?? path;
}

function formatClamp(min: Dim, max: Dim, viewport: Viewport): string {
    const minPx = toPixels(min);
    const maxPx = toPixels(max);

    if (minPx === maxPx) return `${minPx / ROOT_FONT_SIZE}rem`;

    const minRem = minPx / ROOT_FONT_SIZE;
    const maxRem = maxPx / ROOT_FONT_SIZE;
    const minViewportRem = viewport.min / ROOT_FONT_SIZE;
    const maxViewportRem = viewport.max / ROOT_FONT_SIZE;

    const slope = (maxRem - minRem) / (maxViewportRem - minViewportRem);
    const intersection = -1 * minViewportRem * slope + minRem;

    return `clamp(${minRem}rem, ${intersection.toFixed(2)}rem + ${(slope * 100).toFixed(
        2
    )}vw, ${maxRem}rem)`;
}

function toPixels(value: Dim): number {
    return value.unit === "px" ? value.value : value.value * ROOT_FONT_SIZE;
}
