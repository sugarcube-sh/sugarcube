import type { ScaleBinding } from "@sugarcube-sh/core/client";
import { useSnapshot } from "../store/hooks";
import { getScaleExtension } from "../tokens/scale-extension";
import { DirectScaleControl } from "./DirectScaleControl";
import { ExponentialRecipeControl } from "./ExponentialRecipeControl";
import { MultipliersRecipeControl } from "./MultipliersRecipeControl";
import { PerStepScaleControl } from "./PerStepScaleControl";
import { stripTrailingGlob } from "./path-utils";

type ScaleControlProps = {
    binding: ScaleBinding;
};

/**
 * Dispatches between editing models for a `type: "scale"` binding:
 *
 * - Recipe at the bound path → recipe controls (interactive). The
 *   recipe's `mode` selects which control panel: exponential or
 *   multipliers.
 * - Otherwise → bulk sliders + per-step inputs stacked together, both
 *   editing the scale's concrete tokens.
 */
export function ScaleControl({ binding }: ScaleControlProps) {
    const parent = stripTrailingGlob(binding.token);
    const snapshot = useSnapshot();
    const recipe = getScaleExtension(snapshot.trees, parent);

    if (recipe?.mode === "exponential") {
        return <ExponentialRecipeControl binding={binding} />;
    }
    if (recipe?.mode === "multipliers") {
        return <MultipliersRecipeControl binding={binding} />;
    }

    return (
        <>
            <DirectScaleControl binding={binding} />
            <PerStepScaleControl binding={binding} />
        </>
    );
}
