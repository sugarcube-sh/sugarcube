import { roundTo } from "@sugarcube-sh/core/client";
import { useBaseline, useCurrentContext, usePathIndex, useScaleState } from "../../store/hooks";
import { DEFAULT_SPREAD, selectCapture } from "../../store/scale-selectors";
import {
    selectEffectiveScale,
    selectOriginalScale,
    selectScaleFieldEdited,
} from "../../store/scale-state";
import type { ScaleEditField } from "../../store/scale-types";
import { useRafThrottle } from "../../use-raf-throttle";
import type { Adapter } from "../types";

function useFieldReset(token: string, field: ScaleEditField, overridden: boolean) {
    const clearEditField = useScaleState((state) => state.clearEditField);
    return { overridden, reset: overridden ? () => clearEditField(token, field) : undefined };
}

function useScaleComparison(token: string) {
    const meta = useScaleState((state) => state.bindings[token]);
    const edit = useScaleState((state) => state.edits[token]);
    const baseline = useBaseline();

    if (!meta || meta.kind !== "scale") return { effective: null, original: null };
    return {
        effective: selectEffectiveScale(baseline, edit, meta.parentPath),
        original: selectOriginalScale(baseline, meta.parentPath),
    };
}

export const scaleRatioAdapter =
    (token: string): Adapter<number> =>
    () => {
        const updateScale = useScaleState((state) => state.updateScale);
        const { effective, original } = useScaleComparison(token);
        const resettable = useFieldReset(
            token,
            "ratio",
            selectScaleFieldEdited(effective, original, "ratio"),
        );

        function applyRatio(next: number) {
            if (!Number.isFinite(next)) return;
            // The UI has one ratio slider, but the data stores min and max separately.
            // Keep them in sync here.
            updateScale(token, (s) => ({
                ...s,
                ratio: { min: next, max: next },
            }));
        }

        const setRatioThrottled = useRafThrottle(applyRatio);

        // Only an exponential scale carries a ratio.
        const value = effective?.mode === "exponential" ? effective.ratio.max : undefined;

        return {
            value,
            set: setRatioThrottled,
            commit: applyRatio,
            disabled: value === undefined,
            ...resettable,
        };
    };

export const scaleBaseAdapter =
    (token: string): Adapter<number> =>
    () => {
        const updateScale = useScaleState((state) => state.updateScale);
        const { effective, original } = useScaleComparison(token);
        const resettable = useFieldReset(
            token,
            "base",
            selectScaleFieldEdited(effective, original, "base"),
        );

        function applyBase(next: number) {
            if (!Number.isFinite(next)) return;
            updateScale(token, (s) => {
                // Preserve the min/max ratio while moving max to the new value.
                const ratio = s.base.max.value > 0 ? s.base.min.value / s.base.max.value : 1;
                return {
                    ...s,
                    base: {
                        min: { ...s.base.min, value: roundTo(next * ratio) },
                        max: { ...s.base.max, value: next },
                    },
                };
            });
        }

        const setBaseThrottled = useRafThrottle(applyBase);

        const value = effective ? effective.base.max.value : undefined;

        return {
            value,
            set: setBaseThrottled,
            commit: applyBase,
            disabled: value === undefined,
            ...resettable,
        };
    };

function useDirectScale(token: string) {
    const meta = useScaleState((state) => state.bindings[token]);
    const edit = useScaleState((state) => state.edits[token]);
    const baseline = useBaseline();
    const pathIndex = usePathIndex();
    const context = useCurrentContext();

    const captured =
        meta && meta.kind === "tokens"
            ? selectCapture(baseline, pathIndex, meta.binding, context)
            : null;

    return { captured, edit: edit?.kind === "tokens" ? edit : null };
}

export const directBaseAdapter =
    (token: string): Adapter<number> =>
    () => {
        const setBase = useScaleState((state) => state.setBase);
        const { captured, edit } = useDirectScale(token);
        const resettable = useFieldReset(
            token,
            "base",
            edit?.base !== undefined && captured !== null && edit.base !== captured.baseMax,
        );

        function applyBase(next: number) {
            if (!Number.isFinite(next)) return;
            setBase(token, next);
        }

        const setBaseThrottled = useRafThrottle(applyBase);

        const value = captured ? (edit?.base ?? captured.baseMax) : undefined;

        return {
            value,
            set: setBaseThrottled,
            commit: applyBase,
            disabled: value === undefined,
            ...resettable,
        };
    };

export const directSpreadAdapter =
    (token: string): Adapter<number> =>
    () => {
        const setSpread = useScaleState((state) => state.setSpread);
        const { captured, edit } = useDirectScale(token);
        const resettable = useFieldReset(
            token,
            "spread",
            edit?.spread !== undefined && edit.spread !== DEFAULT_SPREAD,
        );

        function applySpread(next: number) {
            if (!Number.isFinite(next)) return;
            setSpread(token, next);
        }

        const setSpreadThrottled = useRafThrottle(applySpread);

        const value = captured ? (edit?.spread ?? DEFAULT_SPREAD) : undefined;

        return {
            value,
            set: setSpreadThrottled,
            commit: applySpread,
            disabled: value === undefined,
            ...resettable,
        };
    };
