import type { ScaleBinding } from "@sugarcube-sh/core/client";
import type { PathIndex } from "../tokens/path-index";
import { type CapturedScale, captureScale } from "../tokens/scale-cascade";
import type { TokenSnapshot } from "../tokens/types";

export const DEFAULT_SPREAD = 1;

export function selectCapture(
    baseline: TokenSnapshot,
    pathIndex: PathIndex,
    binding: ScaleBinding,
    context: string
): CapturedScale | null {
    if (!binding.base) return null;
    return captureScale(binding.token, binding.base, baseline.resolved, pathIndex, context);
}
