import { type ExponentialScaleConfig, type ScaleBinding, roundTo } from "@sugarcube-sh/core/client";
import { useBaseline, useScaleState } from "../store/hooks";
import { selectEffectiveScale } from "../store/scale-state";
import { useRafThrottle } from "../use-raf-throttle";
import { labelForBinding } from "./path-utils";

type ExponentialScaleControlProps = {
    binding: ScaleBinding;
};

const RATIO_MIN = 1;
const RATIO_MAX = 2;

function ratioFillPercent(value: number): number {
    return ((value - RATIO_MIN) / (RATIO_MAX - RATIO_MIN)) * 100;
}

export function ExponentialScaleControl({ binding }: ExponentialScaleControlProps) {
    const meta = useScaleState((s) => s.bindings[binding.token]);
    const edit = useScaleState((s) => s.edits[binding.token]);
    const updateScale = useScaleState((s) => s.updateScale);
    const baseline = useBaseline();

    function applyRatio(next: number) {
        if (!Number.isFinite(next)) return;
        updateScale(binding.token, (s) => ({
            ...s,
            ratio: { min: next, max: next },
        }));
    }

    const setRatioThrottled = useRafThrottle(applyRatio);

    if (!meta || meta.kind !== "scale") return null;
    const effective = selectEffectiveScale(baseline, edit, meta.parentPath);
    if (!effective || effective.mode !== "exponential") return null;
    const scale: ExponentialScaleConfig = effective;

    return (
        <div className="scale-control">
            <div className="scale-control-heading">{labelForBinding(binding)}</div>
            <div className="scale-row">
                <span className="scale-label">Ratio</span>
                <input
                    className="scale-slider"
                    type="range"
                    min={RATIO_MIN}
                    max={RATIO_MAX}
                    step={0.01}
                    value={scale.ratio.max}
                    onChange={(e) => setRatioThrottled(Number(e.target.value))}
                    aria-label="ratio"
                    aria-valuetext={scale.ratio.max.toFixed(2)}
                    style={
                        {
                            "--fill": `${ratioFillPercent(scale.ratio.max)}%`,
                        } as React.CSSProperties
                    }
                />
                <input
                    className="scale-number"
                    type="number"
                    min={RATIO_MIN}
                    max={RATIO_MAX}
                    step={0.01}
                    value={scale.ratio.max}
                    onChange={(e) => applyRatio(Number(e.target.value))}
                    aria-label="ratio value"
                />
            </div>

            <div className="scale-row">
                <span className="scale-label">Base</span>
                <input
                    className="scale-number"
                    type="number"
                    min={0.5}
                    max={2}
                    step={0.025}
                    value={scale.base.max.value}
                    onChange={(e) => {
                        const next = Number(e.target.value);
                        if (!Number.isFinite(next)) return;
                        updateScale(binding.token, (s) => {
                            const ratio =
                                s.base.max.value > 0 ? s.base.min.value / s.base.max.value : 1;
                            return {
                                ...s,
                                base: {
                                    min: { ...s.base.min, value: roundTo(next * ratio) },
                                    max: { ...s.base.max, value: next },
                                },
                            };
                        });
                    }}
                    aria-label="base"
                />
            </div>

            <div className="scale-row">
                <span className="scale-label">Steps</span>
                <input
                    className="scale-number"
                    type="number"
                    min={0}
                    max={20}
                    step={1}
                    value={scale.steps.negative}
                    onChange={(e) => {
                        const next = Number.parseInt(e.target.value, 10);
                        if (!Number.isFinite(next) || next < 0) return;
                        updateScale(binding.token, (s) => {
                            const exp = s as ExponentialScaleConfig;
                            return { ...exp, steps: { ...exp.steps, negative: next } };
                        });
                    }}
                    aria-label="steps down"
                />
                <span className="scale-step-divider" aria-hidden="true">
                    /
                </span>
                <input
                    className="scale-number"
                    type="number"
                    min={0}
                    max={20}
                    step={1}
                    value={scale.steps.positive}
                    onChange={(e) => {
                        const next = Number.parseInt(e.target.value, 10);
                        if (!Number.isFinite(next) || next < 0) return;
                        updateScale(binding.token, (s) => {
                            const exp = s as ExponentialScaleConfig;
                            return { ...exp, steps: { ...exp.steps, positive: next } };
                        });
                    }}
                    aria-label="steps up"
                />
            </div>
        </div>
    );
}
