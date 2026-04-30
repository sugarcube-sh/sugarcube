import type { ScaleBinding } from "@sugarcube-sh/core/client";
import { useSnapshot } from "../store/hooks";
import { getScaleExtension } from "../tokens/scale-extension";
import { DirectScaleControl } from "./DirectScaleControl";
import { PerStepScaleControl } from "./PerStepScaleControl";
import { RecipeScalePreview } from "./RecipeScalePreview";
import { stripTrailingGlob } from "./path-utils";

type ScaleControlProps = {
    binding: ScaleBinding;
};

/**
 * Dispatches between the two editing models for a `type: "scale"` binding:
 *
 * - Recipe at the bound path → recipe preview (interactive recipe
 *   controls follow in a later commit).
 * - Otherwise → bulk sliders + per-step inputs stacked together, both
 *   editing the scale's concrete tokens.
 */
export function ScaleControl({ binding }: ScaleControlProps) {
    const parent = stripTrailingGlob(binding.token);
    const snapshot = useSnapshot();
    const recipe = getScaleExtension(snapshot.trees, parent);

    if (recipe) {
        return <RecipeScalePreview extension={recipe} />;
    }

    return (
        <>
            <DirectScaleControl binding={binding} />
            <PerStepScaleControl binding={binding} />
        </>
    );
}
