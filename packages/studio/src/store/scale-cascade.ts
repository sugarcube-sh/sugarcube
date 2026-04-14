import type { ResolvedTokens } from "@sugarcube-sh/core";
import type { PathIndex } from "./path-index";

/**
 * Generic scale cascade: base + spread transforms over a group of
 * dimension tokens.
 *
 * This is Model A — the cascade approach used when source tokens are
 * explicit. When the scale extension lands in core, scale-extension-backed
 * bindings will bypass this module and use recipe editing directly.
 */

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
    token: ResolvedTokens[string]
): { min: number; max: number; unit: string; hasFluid: boolean } | null {
    if (!token || typeof token !== "object" || !("$value" in token)) return null;

    const $value = (token as { $value: Dim }).$value;
    if (!$value || typeof $value.value !== "number") return null;

    const $extensions = (token as { $extensions?: Record<string, unknown> }).$extensions;
    const sugarcube = $extensions?.["sh.sugarcube"] as
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

/**
 * Capture every token matching `pathPattern` from the snapshot, computing
 * multipliers relative to the base step.
 */
export function captureScale(
    pathPattern: string,
    basePath: string,
    snapshotResolved: ResolvedTokens,
    pathIndex: PathIndex
): CapturedScale | null {
    const baseKeys = pathIndex.keysFor(basePath);
    const baseToken = baseKeys[0] ? snapshotResolved[baseKeys[0]] : undefined;
    const baseFluid = baseToken ? readFluidValues(baseToken) : null;
    if (!baseFluid || baseFluid.max === 0 || baseFluid.min === 0) return null;

    const paths = pathIndex.matching(pathPattern);
    const steps: CapturedStep[] = [];

    for (const path of paths) {
        const keys = pathIndex.keysFor(path);
        const token = keys[0] ? snapshotResolved[keys[0]] : undefined;
        const fluid = token ? readFluidValues(token) : null;
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

/**
 * Capture every static dimension token matching `pathPattern` from the snapshot.
 */
export function captureLinkedScale(
    pathPattern: string,
    snapshotResolved: ResolvedTokens,
    pathIndex: PathIndex
): CapturedLinkedScale {
    const defaults = new Map<string, Dim>();
    const paths = pathIndex.matching(pathPattern);

    for (const path of paths) {
        const keys = pathIndex.keysFor(path);
        const token = keys[0] ? snapshotResolved[keys[0]] : undefined;
        if (!token || !("$value" in token)) continue;

        const $value = (token as { $value: Dim }).$value;
        if ($value && typeof $value.value === "number") {
            defaults.set(path, $value);
        }
    }

    return { defaults };
}

function cleanFloat(value: number, precision = 4): number {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
}

function buildFluidDimensionToken(
    existing: ResolvedTokens[string],
    min: Dim,
    max: Dim,
    emitFluid: boolean
): ResolvedTokens[string] {
    if (!existing || !("$value" in existing)) return existing;

    const base = {
        ...existing,
        $value: max,
        $resolvedValue: max,
    };

    if (!emitFluid) return base as ResolvedTokens[string];

    const existingExtensions = (existing as { $extensions?: Record<string, unknown> }).$extensions;
    const existingSugarcube = (existingExtensions?.["sh.sugarcube"] ?? {}) as Record<
        string,
        unknown
    >;

    return {
        ...base,
        $extensions: {
            ...existingExtensions,
            "sh.sugarcube": {
                ...existingSugarcube,
                fluid: { min, max },
            },
        },
    } as ResolvedTokens[string];
}

function buildStaticDimensionToken(
    existing: ResolvedTokens[string],
    value: Dim
): ResolvedTokens[string] {
    if (!existing || !("$value" in existing)) return existing;
    return {
        ...existing,
        $value: value,
        $resolvedValue: value,
    } as ResolvedTokens[string];
}

/**
 * Apply (base, spread) to a captured scale and write into resolved.
 */
export function applyScaleToResolved(
    resolved: ResolvedTokens,
    scale: CapturedScale | null,
    userBase: number,
    spread: number,
    pathIndex: PathIndex
): ResolvedTokens {
    if (!scale) return resolved;

    const updates: ResolvedTokens = {};
    const newBaseMin = userBase * scale.baseMinRatio;

    for (const step of scale.steps) {
        const adjMax = 1 + (step.maxMultiplier - 1) * spread;
        const adjMin = 1 + (step.minMultiplier - 1) * spread;

        const newMax: Dim = {
            value: cleanFloat(userBase * adjMax),
            unit: step.unit,
        };
        const newMin: Dim = {
            value: cleanFloat(newBaseMin * adjMin),
            unit: step.unit,
        };

        const keys = pathIndex.keysFor(step.path);
        for (const key of keys) {
            const existing = resolved[key];
            if (!existing) continue;
            updates[key] = buildFluidDimensionToken(existing, newMin, newMax, step.hasFluid);
        }
    }

    return { ...resolved, ...updates };
}

/**
 * Apply a linked scale factor to a captured linked-scale group.
 */
export function applyLinkedScaleToResolved(
    resolved: ResolvedTokens,
    scale: CapturedLinkedScale,
    scaleFactor: number,
    enabled: boolean,
    pathIndex: PathIndex
): ResolvedTokens {
    if (!enabled) return resolved;

    const updates: ResolvedTokens = {};

    for (const [path, defaultValue] of scale.defaults.entries()) {
        const keys = pathIndex.keysFor(path);
        if (keys.length === 0) continue;

        const scaledValue: Dim = {
            value: Math.round(defaultValue.value * scaleFactor),
            unit: defaultValue.unit,
        };

        for (const key of keys) {
            const existing = resolved[key];
            if (!existing) continue;
            updates[key] = buildStaticDimensionToken(existing, scaledValue);
        }
    }

    return { ...resolved, ...updates };
}
