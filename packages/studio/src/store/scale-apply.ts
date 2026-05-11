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

    for (const [token, link] of Object.entries(links)) {
        const linkMeta = linkBindings[token];
        if (!linkMeta) continue;
        const sourceMeta = bindings[linkMeta.sourceBinding];
        if (!sourceMeta) continue;

        const sourceCaptured = selectCapture(baseline, pathIndex, sourceMeta.binding, context);
        if (!sourceCaptured) continue;
        const linkedCaptured = captureLinkedScale(
            linkMeta.bindingToken,
            baseline.resolved,
            pathIndex,
            context
        );

        const sourceEdit = edits[linkMeta.sourceBinding];
        const sourceBase =
            sourceEdit?.kind === "tokens" && sourceEdit.base !== undefined
                ? sourceEdit.base
                : sourceCaptured.baseMax;
        const factor = sourceBase / sourceCaptured.baseMax;

        next = applyLinkedScaleToResolved(
            next,
            linkedCaptured,
            factor,
            link.enabled,
            pathIndex,
            context
        );
    }

    return next;
}

/**
 * Materialise a scale extension into per-step dimension tokens (with
 * fluid extension), merged into the resolved map. Turns abstract scale
 * parameters into concrete tokens.
 */
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
