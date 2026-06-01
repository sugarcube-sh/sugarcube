import {
    type ResolvedToken,
    SUGARCUBE_NAMESPACE,
    type ScaleBinding,
    isResolvedToken,
} from "@sugarcube-sh/core/client";
import { useMemo } from "react";
import { useCurrentContext, usePathIndex, useScaleState, useTokenStore } from "../store/hooks";
import type { PathIndex } from "../tokens/path-index";

type Dim = { value: number; unit: "rem" | "px" };

type PerStepScaleControlProps = {
    binding: ScaleBinding;
};

export function PerStepScaleControl({ binding }: PerStepScaleControlProps) {
    const pathIndex = usePathIndex();
    const context = useCurrentContext();
    const setStepOverride = useScaleState((s) => s.setStepOverride);

    // Paths are derived from the (stable) pathIndex, not the resolved map,
    // so this list only changes when the index rebuilds. Each row then
    // subscribes to its own token below.
    const paths = useMemo(() => pathIndex.matching(binding.token), [pathIndex, binding.token]);
    if (paths.length === 0) return null;

    return (
        <>
            {paths.map((path) => (
                <PerStepRow
                    key={path}
                    path={path}
                    pathIndex={pathIndex}
                    context={context}
                    onChange={(next) => {
                        const stepName = path.split(".").pop() ?? path;
                        setStepOverride(binding.token, stepName, next);
                    }}
                />
            ))}
        </>
    );
}

type PerStepRowProps = {
    path: string;
    pathIndex: PathIndex;
    context: string;
    onChange: (next: { min: Dim; max: Dim }) => void;
};

function PerStepRow({ path, pathIndex, context, onChange }: PerStepRowProps) {
    // Subscribe to just this row's token. Unchanged tokens keep their
    // object identity across edits (writeResolved merges via spread), so
    // Object.is bails and this row only renders when its own value moves.
    const token = useTokenStore((state) => {
        const entry = pathIndex.entriesFor(path).find((e) => e.context === context);
        return entry ? state.resolved[entry.key] : undefined;
    });
    const dims = useMemo(() => (isResolvedToken(token) ? readDims(token) : null), [token]);
    if (!dims) return null;

    const label = path.split(".").pop() ?? path;

    return (
        <div className="per-step-row">
            <span className="scale-label">{label}</span>
            <NumberInput
                value={dims.min.value}
                unit={dims.min.unit}
                ariaLabel={`${label} min`}
                onChange={(value) =>
                    onChange({ min: { value, unit: dims.min.unit }, max: dims.max })
                }
            />
            <NumberInput
                value={dims.max.value}
                unit={dims.max.unit}
                ariaLabel={`${label} max`}
                onChange={(value) =>
                    onChange({ min: dims.min, max: { value, unit: dims.max.unit } })
                }
            />
        </div>
    );
}

function readDims(token: ResolvedToken): { min: Dim; max: Dim } | null {
    const value = token.$value as Dim | undefined;
    if (!value || typeof value.value !== "number") return null;

    const sugarcube = token.$extensions?.[SUGARCUBE_NAMESPACE] as
        | { fluid?: { min?: Dim; max?: Dim } }
        | undefined;
    const fluid = sugarcube?.fluid;
    if (fluid?.min && fluid.max) return { min: fluid.min, max: fluid.max };
    return { min: value, max: value };
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
