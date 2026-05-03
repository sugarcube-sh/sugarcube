/**
 * Pure overlay orchestration for cascade scale edits. Iterates user-edited
 * scale slots and link slots, derives captures from the live baseline,
 * applies the cascade transforms, and returns the new resolved map.
 *
 * Stateless: no store coupling. Imported by scale-state's applyAll.
 */

import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import type { PathIndex } from "../tokens/path-index";
import {
    applyLinkedScaleToResolved,
    applyScaleToResolved,
    captureLinkedScale,
} from "../tokens/scale-cascade";
import type { TokenSnapshot } from "../tokens/types";
import { selectCapture } from "./scale-selectors";
import type { LinkSlot, ScaleSlot } from "./scale-types";

export function applyScaleOverlays(
    resolved: ResolvedTokens,
    scales: Record<string, ScaleSlot>,
    links: Record<string, LinkSlot>,
    baseline: TokenSnapshot,
    pathIndex: PathIndex,
    context: string
): ResolvedTokens {
    let next = resolved;

    for (const slot of Object.values(scales)) {
        if (!slot.edits) continue;
        const captured = selectCapture(baseline, pathIndex, slot.binding, context);
        if (!captured) continue;
        next = applyScaleToResolved(
            next,
            captured,
            slot.edits.base,
            slot.edits.spread,
            pathIndex,
            context
        );
    }

    for (const link of Object.values(links)) {
        const sourceSlot = scales[link.sourceBinding];
        if (!sourceSlot) continue;
        const sourceCaptured = selectCapture(baseline, pathIndex, sourceSlot.binding, context);
        if (!sourceCaptured) continue;
        const linkedCaptured = captureLinkedScale(
            link.bindingToken,
            baseline.resolved,
            pathIndex,
            context
        );
        const sourceBase = sourceSlot.edits?.base ?? sourceCaptured.baseMax;
        const factor = sourceBase / sourceCaptured.baseMax;
        const enabled = link.edits?.enabled ?? true;
        next = applyLinkedScaleToResolved(
            next,
            linkedCaptured,
            factor,
            enabled,
            pathIndex,
            context
        );
    }

    return next;
}
