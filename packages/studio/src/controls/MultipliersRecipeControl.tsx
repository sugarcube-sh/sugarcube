import type { MultiplierScaleConfig, ScaleBinding } from "@sugarcube-sh/core/client";
import { useRecipeState } from "../store/hooks";
import { RecipeScalePreview } from "./RecipeScalePreview";
import { labelForBinding } from "./resolver";

type MultipliersRecipeControlProps = {
    binding: ScaleBinding;
};

type PairsMode = "none" | "adjacent" | "custom";

/**
 * Recipe controls for a multipliers scale: base size, editable list of
 * named multipliers, and a pairs toggle (none / adjacent / custom).
 * Applies edits live via the recipe-state slice; preview at the bottom
 * updates in real time.
 */
export function MultipliersRecipeControl({ binding }: MultipliersRecipeControlProps) {
    const slot = useRecipeState((s) => s.slots[binding.token]);
    const update = useRecipeState((s) => s.update);

    if (!slot || slot.current.mode !== "multipliers") return null;
    const recipe = slot.current as MultiplierScaleConfig;
    const label = labelForBinding(binding);

    const pairsMode = pairsToMode(recipe.pairs);

    return (
        <div className="recipe-control">
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
                                min: { ...r.base.min, value: roundTo(next * 0.875, 4) },
                                max: { ...r.base.max, value: next },
                            },
                        }));
                    }}
                    aria-label={`${label} base`}
                />
                <span className="scale-value">{recipe.base.max.value.toFixed(3)}</span>
            </div>

            <div className="recipe-multipliers">
                <span className="scale-label">Sizes</span>
                {Object.entries(recipe.multipliers).map(([name, value]) => (
                    <div className="multiplier-row" key={name}>
                        <span className="multiplier-name">{name}</span>
                        <input
                            className="recipe-number"
                            type="number"
                            min={0}
                            step={0.05}
                            value={value}
                            onChange={(e) => {
                                const next = Number(e.target.value);
                                if (!Number.isFinite(next)) return;
                                update(binding.token, (r) => ({
                                    ...r,
                                    multipliers: {
                                        ...(r as MultiplierScaleConfig).multipliers,
                                        [name]: next,
                                    },
                                }));
                            }}
                            aria-label={`${name} multiplier`}
                        />
                    </div>
                ))}
            </div>

            <div className="scale-row">
                <span className="scale-label">Pairs</span>
                <select
                    className="recipe-select"
                    value={pairsMode}
                    onChange={(e) => {
                        const nextMode = e.target.value as PairsMode;
                        update(binding.token, (r) => {
                            const multi = r as MultiplierScaleConfig;
                            const { pairs: _drop, ...rest } = multi;
                            if (nextMode === "none") return rest;
                            if (nextMode === "adjacent") {
                                return { ...rest, pairs: "adjacent" } as MultiplierScaleConfig;
                            }
                            return { ...rest, pairs: [] as string[] } as MultiplierScaleConfig;
                        });
                    }}
                    aria-label="pairs mode"
                >
                    <option value="none">None</option>
                    <option value="adjacent">Adjacent</option>
                    <option value="custom">Custom list</option>
                </select>
            </div>

            <RecipeScalePreview extension={recipe} />
        </div>
    );
}

function pairsToMode(pairs: MultiplierScaleConfig["pairs"]): PairsMode {
    if (pairs === "adjacent") return "adjacent";
    if (Array.isArray(pairs)) return "custom";
    return "none";
}

function roundTo(value: number, precision: number): number {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
}
