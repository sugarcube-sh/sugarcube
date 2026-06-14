import {
    type ResolvedTokens,
    SUGARCUBE_NAMESPACE,
    type ScaleExtension,
    calculateScale,
    isResolvedToken,
} from "@sugarcube-sh/core/client";
import type { PathIndex } from "../tokens/path-index";
import {
    applyLinkedScaleToResolved,
    applyScaleToResolved,
    captureLinkedScale,
} from "../tokens/scale-cascade";
import { getScaleExtension } from "../tokens/scale-extension";
import type { TokenSnapshot } from "../tokens/types";
import { selectCapture } from "./scale-selectors";
import type { LinkBindingMeta, LinkEdit, ScaleBindingMeta, ScaleEdit } from "./scale-types";

type Dim = { value: number; unit: "rem" | "px" };

export function applyScaleEdits(
    resolved: ResolvedTokens,
    edits: Record<string, ScaleEdit>,
    links: Record<string, LinkEdit>,
    bindings: Record<string, ScaleBindingMeta>,
    linkBindings: Record<string, LinkBindingMeta>,
    baseline: TokenSnapshot,
    pathIndex: PathIndex,
    context: string
): ResolvedTokens {
    let next = resolved;

    for (const [token, edit] of Object.entries(edits)) {
        const meta = bindings[token];
        if (!meta) continue;

        if (edit.kind === "tokens") {
            const hasTokensEdit =
                edit.base !== undefined || edit.spread !== undefined || edit.overrides;
            if (!hasTokensEdit) continue;
            const captured = selectCapture(baseline, pathIndex, meta.binding, context);
            if (!captured) continue;
            const base = edit.base ?? captured.baseMax;
            const spread = edit.spread ?? 1;
            next = applyScaleToResolved(
                next,
                captured,
                base,
                spread,
                pathIndex,
                context,
                edit.overrides
            );
        } else if (edit.kind === "scale") {
            next = materializeScale(next, edit.scale, meta.parentPath, pathIndex, context);
        }
    }

    for (const [token, linkMeta] of Object.entries(linkBindings)) {
        const sourceMeta = bindings[linkMeta.sourceBinding];
        if (!sourceMeta) continue;

        const linkedCaptured = captureLinkedScale(
            linkMeta.bindingToken,
            baseline.resolved,
            pathIndex,
            context
        );

        // Containers track the source's ratio (proportional shape), not its
        // base (body font size — a side effect we don't want bundled into
        // layout). Only exponential-mode scale edits carry a ratio; other
        // edit kinds leave the factor at 1 and the link is a no-op.
        const sourceEdit = edits[linkMeta.sourceBinding];
        let factor = 1;
        if (sourceEdit?.kind === "scale" && sourceEdit.scale.mode === "exponential") {
            const original = getScaleExtension(baseline.trees, sourceMeta.parentPath);
            if (original?.mode === "exponential" && original.ratio.max > 0) {
                factor = sourceEdit.scale.ratio.max / original.ratio.max;
            }
        }
        const enabled = links[token]?.enabled ?? true;

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

export function materializeScale(
    resolved: ResolvedTokens,
    scale: ScaleExtension,
    parentPath: string,
    pathIndex: PathIndex,
    context: string
): ResolvedTokens {
    const steps = calculateScale(scale);
    const updates: ResolvedTokens = {};

    for (const step of steps) {
        const stepPath = `${parentPath}.${step.name}`;
        const entries = pathIndex.entriesFor(stepPath).filter((e) => e.context === context);
        for (const { key } of entries) {
            const next = buildScaleStepToken(resolved[key], step.min, step.max);
            if (next) updates[key] = next;
        }
    }

    return { ...resolved, ...updates };
}

function buildScaleStepToken(
    existing: ResolvedTokens[string] | undefined,
    min: Dim,
    max: Dim
): ResolvedTokens[string] | null {
    if (!isResolvedToken(existing)) return null;

    const existingSugarcube = (existing.$extensions?.[SUGARCUBE_NAMESPACE] ?? {}) as Record<
        string,
        unknown
    >;

    return {
        ...existing,
        $value: max,
        $resolvedValue: max,
        $extensions: {
            ...existing.$extensions,
            [SUGARCUBE_NAMESPACE]: {
                ...existingSugarcube,
                fluid: { min, max },
            },
        },
    } as ResolvedTokens[string];
}
