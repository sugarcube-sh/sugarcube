import type { ResolvedTokens } from "@sugarcube-sh/core";
import type { PathIndex } from "./path-index";

/**
 * Generic scale cascade: base + spread transforms over a group of
 * dimension tokens.
 *
 * Studio exposes two knobs per scale binding: a BASE size and a
 * SPREAD factor. Both are applied as a uniform transform on top of the
 * project's curated scale, rather than regenerating it from a formula.
 * This preserves the character of the source scale while letting the
 * user resize or compress/expand it.
 *
 *   - The project's actual ratios (whatever the designer chose) are
 *     preserved when both sliders are at their defaults — including
 *     deliberately uneven steps like text scales that diverge from a
 *     pure exponential ratio.
 *   - The user can experiment with a tighter or looser scale via spread
 *     without losing the curated character of the original.
 *   - The cascade is mode-agnostic: the math works the same whether
 *     the source came from an exponential, multiplier, or hand-tuned
 *     scale.
 *
 * The math:
 *
 *   For each step we capture an original (minMultiplier, maxMultiplier)
 *   relative to the scale's BASE STEP — named explicitly by the panel
 *   config via `binding.base`.
 *
 *   Spread is applied around 1.0:
 *     adjusted = 1 + (original - 1) × spread
 *   So spread = 1 reproduces the originals exactly, spread = 0 collapses
 *   every step to the base, and spread > 1 amplifies the existing
 *   distances between steps.
 *
 *   Base scaling is a uniform multiplier on the result:
 *     newMax = userBase × adjustedMaxMultiplier
 *     newMin = (userBase × baseMinRatio) × adjustedMinMultiplier
 *   where `baseMinRatio` is the original min/max ratio of the base step,
 *   so the fluid character of the project's base is preserved as the
 *   user resizes.
 *
 * Container tokens are static dimensions (no fluid extension). Container
 * scaling is a simple uniform factor on the captured snapshot defaults,
 * exposed via `captureLinkedScale` + `applyLinkedScaleToResolved`.
 *
 * This module is **Model A** — the cascade approach used when the source
 * tokens are explicit. When the spec's scale extension lands in core,
 * scale-extension-backed bindings will bypass this module entirely and
 * use a recipe-editing path (edit `base`, `ratio`, etc. directly on the
 * extension, regenerate via the core scale calculator).
 */

type Dim = { value: number; unit: string };

/**
 * One captured step from the snapshot — the original min/max values plus
 * the multipliers (relative to the base step) we'll spread-transform at
 * apply time.
 */
type CapturedStep = {
    path: string;
    unit: string;
    origMin: number;
    origMax: number;
    minMultiplier: number;
    maxMultiplier: number;
    /** True if the source token had a fluid extension to update. */
    hasFluid: boolean;
};

export type CapturedScale = {
    /** The base step's original min and max (e.g. 0.95 / 1 for size.step.0). */
    baseMin: number;
    baseMax: number;
    /** baseMin / baseMax — preserved as the user resizes the base. */
    baseMinRatio: number;
    steps: CapturedStep[];
};

/**
 * A captured group of static dimension tokens, used by linked scales
 * (bindings with `scalesWith`). Stores the original snapshot values so
 * that a scale factor of 1.0 always reproduces the project's defaults,
 * regardless of any prior edits.
 */
export type CapturedLinkedScale = {
    defaults: Map<string, Dim>;
};

/**
 * Read a token's fluid extension min/max if present, falling back to its
 * static `$value` for both. Returns the values as plain numbers in their
 * original unit, plus a flag for whether the source had a fluid extension
 * (so the writer knows whether to emit one).
 */
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
 * its (minMultiplier, maxMultiplier) relative to the given base step's
 * original min/max. Skips tokens whose base step doesn't exist or whose
 * base values are zero (multiplier would be undefined).
 *
 * Call this once per scale binding, ideally at control mount time. The
 * returned `CapturedScale` is immutable — it snapshots the source
 * values at the moment of capture and the math uses these as the
 * originals that `applyScaleToResolved` transforms.
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
 * Capture every static dimension token matching `pathPattern` from the
 * snapshot. Returns a `CapturedLinkedScale` suitable for passing to
 * `applyLinkedScaleToResolved`.
 *
 * Call once per linked-scale binding (e.g., once for `container.*`) at
 * control mount time.
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

/**
 * Round a floating-point result to a fixed decimal precision.
 *
 * Four decimals is the Utopia convention for fluid scales — same
 * precision that `--step-3: clamp(1.944rem, 1.7405rem + …, 2.4414rem)`
 * output uses, which is the de facto standard designers recognize. It:
 *
 *   - Kills JavaScript's binary-float drift (`4.799999999999999` → `4.8`)
 *   - Preserves every clean designer value — `1.125`, `1.0625`, `4.8`,
 *     `1.5625` all fit within 4 decimals exactly
 *   - Trims machine-generated precision like `1.953125` → `1.9531`,
 *     matching what Utopia prints for the same math
 *   - Is sub-pixel invisible (4th decimal rem ≈ 0.0016 px)
 *
 * Applied at the point where new values are computed, so the store,
 * the diff, and the generated CSS all agree. When the scale extension
 * lands in core, its calculator should use the same 4-decimal precision
 * so the convention stays consistent across Model A (this cascade) and
 * Model B (build-time scale expansion).
 */
function cleanFloat(value: number, precision = 4): number {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
}

/**
 * Construct an immutable token update that sets both `$value` /
 * `$resolvedValue` AND (when applicable) the sugarcube fluid extension.
 * Preserves any other extensions on the token.
 */
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
 * Apply (base, spread) to a captured scale and write the new values into
 * `resolved`. Generic: any captured scale works — the caller provides
 * whichever one matches the binding being edited.
 *
 * `userBase` is interpreted as the new max-viewport size of the scale's
 * base step. `spread` of 1 reproduces the project's curated scale; 0
 * collapses every step to the base; values >1 amplify the distances.
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
 * Apply a linked scale factor to a captured linked-scale group. When
 * `scaleFactor` is 1.0, returns the original snapshot defaults. Otherwise
 * multiplies each captured default by the factor.
 *
 * If `enabled` is false, returns the input unchanged — the `scalesWith`
 * binding's toggle uses this to opt out.
 *
 * Values are rounded to integers: this path is specifically for static
 * dimension tokens (e.g. integer pixel containers). Fluid dimensions
 * use `applyScaleToResolved` instead.
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
