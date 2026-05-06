import {
    type ResolvedToken,
    type ResolvedTokens,
    type ScaleBinding,
    isResolvedToken,
} from "@sugarcube-sh/core/client";
import { useCurrentContext, usePathIndex, useTokenStore, useTokenStoreApi } from "../store/hooks";
import type { PathIndex } from "../tokens/path-index";

type Dim = { value: number; unit: "rem" | "px" };

type PerStepScaleControlProps = {
    binding: ScaleBinding;
};

/**
 * Per-step inputs for a hardcoded scale: one row per token in the
 * binding's path, with min/max number inputs that write directly to
 * each token's `$value` and fluid extension. Renders alongside the
 * bulk sliders so the user has both bulk and granular editing.
 */
export function PerStepScaleControl({ binding }: PerStepScaleControlProps) {
    const pathIndex = usePathIndex();
    const resolved = useTokenStore((s) => s.resolved);
    const context = useCurrentContext();
    const storeApi = useTokenStoreApi();

    const rows = collectRows(binding.token, resolved, pathIndex, context);
    if (rows.length === 0) return null;

    function applyEdit(path: string, next: { min: Dim; max: Dim }) {
        const state = storeApi.getState();
        storeApi.setState({
            resolved: writeFluidStep(state.resolved, pathIndex, path, context, next),
        });
    }

    return (
        <>
            {rows.map((row) => (
                <PerStepRow
                    key={row.path}
                    row={row}
                    onChange={(next) => applyEdit(row.path, next)}
                />
            ))}
        </>
    );
}

type Row = {
    path: string;
    label: string;
    min: Dim;
    max: Dim;
};

function collectRows(
    pattern: string,
    resolved: ResolvedTokens,
    pathIndex: PathIndex,
    context: string
): Row[] {
    const paths = pathIndex.matching(pattern);
    const rows: Row[] = [];
    for (const path of paths) {
        const entry = pathIndex.entriesFor(path).find((e) => e.context === context);
        const token = entry ? resolved[entry.key] : undefined;
        if (!isResolvedToken(token)) continue;
        const dims = readDims(token);
        if (!dims) continue;
        rows.push({
            path,
            label: path.split(".").pop() ?? path,
            min: dims.min,
            max: dims.max,
        });
    }
    return rows;
}

function readDims(token: ResolvedToken): { min: Dim; max: Dim } | null {
    const value = token.$value as Dim | undefined;
    if (!value || typeof value.value !== "number") return null;

    const sugarcube = token.$extensions?.["sh.sugarcube"] as
        | { fluid?: { min?: Dim; max?: Dim } }
        | undefined;
    const fluid = sugarcube?.fluid;
    if (fluid?.min && fluid.max) return { min: fluid.min, max: fluid.max };
    return { min: value, max: value };
}

function writeFluidStep(
    resolved: ResolvedTokens,
    pathIndex: PathIndex,
    path: string,
    context: string,
    next: { min: Dim; max: Dim }
): ResolvedTokens {
    const entries = pathIndex.entriesFor(path).filter((e) => e.context === context);
    const updates: ResolvedTokens = {};

    for (const { key } of entries) {
        const existing = resolved[key];
        if (!isResolvedToken(existing)) continue;

        const existingSugarcube = (existing.$extensions?.["sh.sugarcube"] ?? {}) as Record<
            string,
            unknown
        >;

        updates[key] = {
            ...existing,
            $value: next.max,
            $resolvedValue: next.max,
            $extensions: {
                ...existing.$extensions,
                "sh.sugarcube": {
                    ...existingSugarcube,
                    fluid: { min: next.min, max: next.max },
                },
            },
        } as ResolvedTokens[string];
    }

    return { ...resolved, ...updates };
}

type PerStepRowProps = {
    row: Row;
    onChange: (next: { min: Dim; max: Dim }) => void;
};

function PerStepRow({ row, onChange }: PerStepRowProps) {
    return (
        <div className="per-step-row">
            <span className="scale-label">{row.label}</span>
            <NumberInput
                value={row.min.value}
                unit={row.min.unit}
                ariaLabel={`${row.label} min`}
                onChange={(value) => onChange({ min: { value, unit: row.min.unit }, max: row.max })}
            />
            <NumberInput
                value={row.max.value}
                unit={row.max.unit}
                ariaLabel={`${row.label} max`}
                onChange={(value) => onChange({ min: row.min, max: { value, unit: row.max.unit } })}
            />
        </div>
    );
}

type NumberInputProps = {
    value: number;
    unit: "rem" | "px";
    ariaLabel: string;
    onChange: (value: number) => void;
};

function NumberInput({ value, unit, ariaLabel, onChange }: NumberInputProps) {
    return (
        <label className="per-step-input">
            <input
                type="number"
                value={value}
                step={0.0625}
                onChange={(e) => {
                    const next = Number(e.target.value);
                    if (Number.isFinite(next)) onChange(next);
                }}
                aria-label={ariaLabel}
            />
            <span className="per-step-unit">{unit}</span>
        </label>
    );
}
