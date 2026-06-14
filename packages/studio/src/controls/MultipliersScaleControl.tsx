import { type MultiplierScaleConfig, type ScaleBinding, roundTo } from "@sugarcube-sh/core/client";
import { useBaseline, useScaleState } from "../store/hooks";
import { selectEffectiveScale } from "../store/scale-state";
import { useRafThrottle } from "../use-raf-throttle";
import { labelForBinding } from "./path-utils";

type MultipliersScaleControlProps = {
    binding: ScaleBinding;
};

const BASE_MIN = 0.5;
const BASE_MAX = 2;

function baseFillPercent(value: number): number {
    return ((value - BASE_MIN) / (BASE_MAX - BASE_MIN)) * 100;
}

export function MultipliersScaleControl({ binding }: MultipliersScaleControlProps) {
    const meta = useScaleState((s) => s.bindings[binding.token]);
    const edit = useScaleState((s) => s.edits[binding.token]);
    const updateScale = useScaleState((s) => s.updateScale);
    const baseline = useBaseline();

    function applyBase(next: number) {
        if (!Number.isFinite(next)) return;
        updateScale(binding.token, (s) => {
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

    if (!meta || meta.kind !== "scale") return null;
    const effective = selectEffectiveScale(baseline, edit, meta.parentPath);
    if (!effective || effective.mode !== "multipliers") return null;
    const scale: MultiplierScaleConfig = effective;

    return (
        <div className="scale-control flow flow-space-3xs">
            <div className="scale-control-heading">{labelForBinding(binding)}</div>
            <div className="cluster cluster-gap-2xs" data-cluster-wrap="nowrap">
                <span className="scale-label">Base</span>
                <input
                    className="scale-slider"
                    type="range"
                    min={BASE_MIN}
                    max={BASE_MAX}
                    step={0.05}
                    value={scale.base.max.value}
                    onChange={(e) => setBaseThrottled(Number(e.target.value))}
                    aria-label="base"
                    aria-valuetext={`${scale.base.max.value}${scale.base.max.unit}`}
                    style={
                        {
                            "--fill": `${baseFillPercent(scale.base.max.value)}%`,
                        } as React.CSSProperties
                    }
                />
                <input
                    className="scale-number"
                    type="number"
                    min={BASE_MIN}
                    max={BASE_MAX}
                    step={0.05}
                    value={scale.base.max.value}
                    onChange={(e) => applyBase(Number(e.target.value))}
                    aria-label="base value"
                />
            </div>
        </div>
    );
}
