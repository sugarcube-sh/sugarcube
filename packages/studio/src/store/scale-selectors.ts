/**
 * Pure selectors for cascade scale state. Derive the binding's capture
 * (baseMax + per-step multipliers) from the live baseline on demand —
 * never captured at mount.
 */

import type { ScaleBinding } from "@sugarcube-sh/core/client";
import type { PathIndex } from "../tokens/path-index";
import { type CapturedScale, captureScale } from "../tokens/scale-cascade";
import type { TokenSnapshot } from "../tokens/types";

export const DEFAULT_SPREAD = 1;

/**
 * Derive the cascade capture for a binding from the live baseline.
 * Used by both the controls (slider min/max) and the apply layer (to
 * compute overlay values).
 */
export function selectCapture(
    baseline: TokenSnapshot,
    pathIndex: PathIndex,
    binding: ScaleBinding,
    context: string
): CapturedScale | null {
    if (!binding.base) return null;
    return captureScale(binding.token, binding.base, baseline.resolved, pathIndex, context);
}
