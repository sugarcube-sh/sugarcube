import type { ExponentialScaleConfig, ScaleBinding } from "@sugarcube-sh/core/client";
import { useBaseline, useRecipeState } from "../store/hooks";
import { selectEffective } from "../store/recipe-state";
import { RecipeScalePreview } from "./RecipeScalePreview";
import { labelForBinding } from "./resolver";

type ExponentialRecipeControlProps = {
    binding: ScaleBinding;
};

const RATIO_PRESETS = [
    { label: "Minor Second (1.067)", value: 1.067 },
    { label: "Major Second (1.125)", value: 1.125 },
    { label: "Minor Third (1.2)", value: 1.2 },
    { label: "Major Third (1.25)", value: 1.25 },
    { label: "Perfect Fourth (1.333)", value: 1.333 },
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: rounded musical ratio for preset label/value consistency
    { label: "Augmented Fourth (1.414)", value: 1.414 },
    { label: "Perfect Fifth (1.5)", value: 1.5 },
    { label: "Golden Ratio (1.618)", value: 1.618 },
];

/**
 * Recipe controls for an exponential scale: ratio, base size, and step
 * counts. Applies edits live via the recipe-state slice; the preview
 * table at the bottom updates in real time.
 */
export function ExponentialRecipeControl({ binding }: ExponentialRecipeControlProps) {
    const slot = useRecipeState((s) => s.slots[binding.token]);
    const update = useRecipeState((s) => s.update);
    const baseline = useBaseline();

    if (!slot) return null;
    const effective = selectEffective(baseline, slot);
    if (!effective || effective.mode !== "exponential") return null;
    const recipe = effective as ExponentialScaleConfig;
    const label = labelForBinding(binding);

    return (
        <div className="recipe-control">
            <div className="scale-row">
                <span className="scale-label">{label} ratio</span>
                <select
                    className="recipe-select"
                    value={String(recipe.ratio.max)}
                    onChange={(e) => {
                        const next = Number(e.target.value);
                        if (!Number.isFinite(next)) return;
                        update(binding.token, (r) => ({
                            ...r,
                            ratio: { min: next, max: next },
                        }));
                    }}
                    aria-label={`${label} ratio`}
                >
                    {RATIO_PRESETS.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                            {preset.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="scale-row">
                <span className="scale-label">{label} base</span>
                <input
                    className="scale-slider"
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.025}
                    value={recipe.base.max.value}
                    onChange={(e) => {
                        const next = Number(e.target.value);
                        if (!Number.isFinite(next)) return;
                        update(binding.token, (r) => ({
                            ...r,
                            base: {
                                min: { ...r.base.min, value: roundTo(next * 0.95, 4) },
                                max: { ...r.base.max, value: next },
                            },
                        }));
                    }}
                    aria-label={`${label} base`}
                />
                <span className="scale-value">{recipe.base.max.value.toFixed(3)}</span>
            </div>

            <div className="scale-row">
                <span className="scale-label">{label} steps up</span>
                <input
                    className="recipe-number"
                    type="number"
                    min={0}
                    max={20}
                    step={1}
                    value={recipe.steps.positive}
                    onChange={(e) => {
                        const next = Number.parseInt(e.target.value, 10);
                        if (!Number.isFinite(next) || next < 0) return;
                        update(binding.token, (r) => {
                            const exp = r as ExponentialScaleConfig;
                            return { ...exp, steps: { ...exp.steps, positive: next } };
                        });
                    }}
                    aria-label={`${label} steps up`}
                />
            </div>

            <div className="scale-row">
                <span className="scale-label">{label} steps down</span>
                <input
                    className="recipe-number"
                    type="number"
                    min={0}
                    max={20}
                    step={1}
                    value={recipe.steps.negative}
                    onChange={(e) => {
                        const next = Number.parseInt(e.target.value, 10);
                        if (!Number.isFinite(next) || next < 0) return;
                        update(binding.token, (r) => {
                            const exp = r as ExponentialScaleConfig;
                            return { ...exp, steps: { ...exp.steps, negative: next } };
                        });
                    }}
                    aria-label={`${label} steps down`}
                />
            </div>

            <RecipeScalePreview extension={recipe} />
        </div>
    );
}

function roundTo(value: number, precision: number): number {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
}
