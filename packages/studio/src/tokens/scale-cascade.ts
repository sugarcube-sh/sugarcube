import {
    type ResolvedTokens,
    SUGARCUBE_NAMESPACE,
    isResolvedToken,
    roundTo,
} from "@sugarcube-sh/core/client";
import type { PathIndex } from "./path-index";

type Dim = { value: number; unit: string };

type CapturedStep = {
    path: string;
    unit: string;
    origMin: number;
    origMax: number;
    minMultiplier: number;
    maxMultiplier: number;
    hasFluid: boolean;
};

export type CapturedScale = {
    baseMin: number;
    baseMax: number;
    baseMinRatio: number;
    steps: CapturedStep[];
};

export type CapturedLinkedScale = {
    defaults: Map<string, Dim>;
};

function readFluidValues(
    token: ResolvedTokens[string] | undefined
): { min: number; max: number; unit: string; hasFluid: boolean } | null {
    if (!isResolvedToken(token)) return null;

    const $value = token.$value as Dim;
    if (!$value || typeof $value.value !== "number") return null;

    const sugarcube = token.$extensions?.[SUGARCUBE_NAMESPACE] as
        | { fluid?: { min: Dim; max: Dim } }
        | undefined;
    const fluid = sugarcube?.fluid;

    if (fluid?.min && fluid.max) {
        return {
            min: fluid.min.value,
            max: fluid.max.value,
            unit: fluid.max.unit,
            hasFluid: true,
        };
    }

    return {
        min: $value.value,
        max: $value.value,
        unit: $value.unit,
        hasFluid: false,
    };
}

export function captureScale(
    pathPattern: string,
    basePath: string,
    snapshotResolved: ResolvedTokens,
    pathIndex: PathIndex,
    context: string
): CapturedScale | null {
    const baseEntry = pathIndex.entriesFor(basePath).find((e) => e.context === context);
    const baseToken = baseEntry ? snapshotResolved[baseEntry.key] : undefined;
    const baseFluid = readFluidValues(baseToken);
    if (!baseFluid || baseFluid.max === 0 || baseFluid.min === 0) return null;

    const paths = pathIndex.matching(pathPattern);
    const steps: CapturedStep[] = [];

    for (const path of paths) {
        const entry = pathIndex.entriesFor(path).find((e) => e.context === context);
        const token = entry ? snapshotResolved[entry.key] : undefined;
        const fluid = readFluidValues(token);
        if (!fluid) continue;

        steps.push({
            path,
            unit: fluid.unit,
            origMin: fluid.min,
            origMax: fluid.max,
            minMultiplier: fluid.min / baseFluid.min,
            maxMultiplier: fluid.max / baseFluid.max,
            hasFluid: fluid.hasFluid,
        });
    }

    return {
        baseMin: baseFluid.min,
        baseMax: baseFluid.max,
        baseMinRatio: baseFluid.min / baseFluid.max,
        steps,
    };
}

export function captureLinkedScale(
    pathPattern: string,
    snapshotResolved: ResolvedTokens,
    pathIndex: PathIndex,
    context: string
): CapturedLinkedScale {
    const defaults = new Map<string, Dim>();
    const paths = pathIndex.matching(pathPattern);

    for (const path of paths) {
        const entry = pathIndex.entriesFor(path).find((e) => e.context === context);
        const token = entry ? snapshotResolved[entry.key] : undefined;
        if (!isResolvedToken(token)) continue;

        const $value = token.$value as Dim;
        if ($value && typeof $value.value === "number") {
            defaults.set(path, $value);
        }
    }

    return { defaults };
}

function buildFluidDimensionToken(
    existing: ResolvedTokens[string] | undefined,
    min: Dim,
    max: Dim,
    emitFluid: boolean
): ResolvedTokens[string] | null {
    if (!isResolvedToken(existing)) return null;

    const base = {
        ...existing,
        $value: max,
        $resolvedValue: max,
    };

    if (!emitFluid) return base as ResolvedTokens[string];

    const existingSugarcube = (existing.$extensions?.[SUGARCUBE_NAMESPACE] ?? {}) as Record<
        string,
        unknown
    >;

    return {
        ...base,
        $extensions: {
            ...existing.$extensions,
            [SUGARCUBE_NAMESPACE]: {
                ...existingSugarcube,
                fluid: { min, max },
            },
        },
    } as ResolvedTokens[string];
}

function buildStaticDimensionToken(
    existing: ResolvedTokens[string] | undefined,
    value: Dim
): ResolvedTokens[string] | null {
    if (!isResolvedToken(existing)) return null;
    return {
        ...existing,
        $value: value,
        $resolvedValue: value,
    } as ResolvedTokens[string];
}

export type StepOverrideMap = Record<string, { min: Dim; max: Dim }>;

export function applyScaleToResolved(
    resolved: ResolvedTokens,
    scale: CapturedScale | null,
    userBase: number,
    spread: number,
    pathIndex: PathIndex,
    context: string,
    overrides?: StepOverrideMap
): ResolvedTokens {
    if (!scale) return resolved;

    const updates: ResolvedTokens = {};
    const newBaseMin = userBase * scale.baseMinRatio;

    for (const step of scale.steps) {
        const stepName = step.path.split(".").pop() ?? step.path;
        const override = overrides?.[stepName];

        let newMax: Dim;
        let newMin: Dim;
        if (override) {
            // User has pinned this step — preserve their values verbatim.
            newMax = override.max;
            newMin = override.min;
        } else {
            const adjMax = 1 + (step.maxMultiplier - 1) * spread;
            const adjMin = 1 + (step.minMultiplier - 1) * spread;
            newMax = { value: roundTo(userBase * adjMax), unit: step.unit };
            newMin = { value: roundTo(newBaseMin * adjMin), unit: step.unit };
        }

        const entries = pathIndex.entriesFor(step.path).filter((e) => e.context === context);
        for (const { key } of entries) {
            const next = buildFluidDimensionToken(resolved[key], newMin, newMax, step.hasFluid);
            if (next) updates[key] = next;
        }
    }

    return { ...resolved, ...updates };
}

export function applyLinkedScaleToResolved(
    resolved: ResolvedTokens,
    scale: CapturedLinkedScale,
    scaleFactor: number,
    enabled: boolean,
    pathIndex: PathIndex,
    context: string
): ResolvedTokens {
    // When disabled, apply with factor 1.0 to restore snapshot defaults
    // rather than freezing at the last-scaled values.
    const factor = enabled ? scaleFactor : 1;

    const updates: ResolvedTokens = {};

    for (const [path, defaultValue] of scale.defaults.entries()) {
        const entries = pathIndex.entriesFor(path).filter((e) => e.context === context);
        if (entries.length === 0) continue;

        const scaledValue: Dim = {
            value: Math.round(defaultValue.value * factor),
            unit: defaultValue.unit,
        };

        for (const { key } of entries) {
            const next = buildStaticDimensionToken(resolved[key], scaledValue);
            if (next) updates[key] = next;
        }
    }

    return { ...resolved, ...updates };
}
