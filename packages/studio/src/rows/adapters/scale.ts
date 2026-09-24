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

const ratioAdapter =
    (token: string, edge: "min" | "max"): Adapter<number> =>
    () => {
        const updateScale = useScaleState((state) => state.updateScale);
        const { effective, original } = useScaleComparison(token);
        const field: ScaleEditField = edge === "min" ? "ratioMin" : "ratioMax";
        const resettable = useFieldReset(
            token,
            field,
            selectScaleFieldEdited(effective, original, field),
        );

        function apply(next: number) {
            if (!Number.isFinite(next)) return;
            updateScale(token, (scale) =>
                scale.mode === "exponential"
                    ? { ...scale, ratio: { ...scale.ratio, [edge]: next } }
                    : scale,
            );
        }

        const applyThrottled = useRafThrottle(apply);
        const value = effective?.mode === "exponential" ? effective.ratio[edge] : undefined;

        return {
            value,
            set: applyThrottled,
            commit: apply,
            disabled: value === undefined,
            ...resettable,
        };
    };

export const scaleRatioMinAdapter = (token: string) => ratioAdapter(token, "min");
export const scaleRatioMaxAdapter = (token: string) => ratioAdapter(token, "max");

const recipeBaseAdapter =
    (token: string, edge: "min" | "max"): Adapter<number> =>
    () => {
        const updateScale = useScaleState((state) => state.updateScale);
        const { effective, original } = useScaleComparison(token);
        const field: ScaleEditField = edge === "min" ? "baseMin" : "baseMax";
        const resettable = useFieldReset(
            token,
            field,
            selectScaleFieldEdited(effective, original, field),
        );

        function apply(next: number) {
            if (!Number.isFinite(next)) return;
            updateScale(token, (scale) => ({
                ...scale,
                base: { ...scale.base, [edge]: { ...scale.base[edge], value: roundTo(next) } },
            }));
        }

        const applyThrottled = useRafThrottle(apply);
        const value = effective?.base[edge].value;

        return {
            value,
            set: applyThrottled,
            commit: apply,
            disabled: value === undefined,
            ...resettable,
        };
    };

export const scaleBaseMinAdapter = (token: string) => recipeBaseAdapter(token, "min");
export const scaleBaseMaxAdapter = (token: string) => recipeBaseAdapter(token, "max");

export const scaleMultiplierAdapter =
    (token: string, name: string): Adapter<number> =>
    () => {
        const updateScale = useScaleState((state) => state.updateScale);
        const { effective, original } = useScaleComparison(token);
        const field: ScaleEditField = { multiplier: name };
        const resettable = useFieldReset(
            token,
            field,
            selectScaleFieldEdited(effective, original, field),
        );

        function apply(next: number) {
            if (!Number.isFinite(next)) return;
            updateScale(token, (scale) =>
                scale.mode === "multipliers"
                    ? { ...scale, multipliers: { ...scale.multipliers, [name]: roundTo(next) } }
                    : scale,
            );
        }

        const applyThrottled = useRafThrottle(apply);
        const value = effective?.mode === "multipliers" ? effective.multipliers[name] : undefined;

        return {
            value,
            set: applyThrottled,
            commit: apply,
            disabled: value === undefined,
            ...resettable,
        };
    };

function useDirectScale(token: string) {
    const meta = useScaleState((state) => state.bindings[token]);
    const edit = useScaleState((state) => state.edits[token]);
    const basePath = useScaleState((state) => state.bases[token]);
    const baseline = useBaseline();
    const pathIndex = usePathIndex();
    const context = useCurrentContext();

    const captured =
        meta && meta.kind === "tokens"
            ? selectCapture(baseline, pathIndex, meta.binding, context, basePath)
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

export const scaleFromAdapter =
    (token: string): Adapter<string> =>
    () => {
        const setScaleBase = useScaleState((state) => state.setScaleBase);
        const chosen = useScaleState((state) => state.bases[token]);
        const authored = useScaleState((state) => state.authoredBases[token]);
        const overridden = chosen !== undefined && chosen !== authored;

        function set(next: string) {
            setScaleBase(token, next);
        }

        return {
            value: chosen,
            set,
            commit: set,
            overridden,
            reset: overridden && authored ? () => setScaleBase(token, authored) : undefined,
        };
    };
