import type { ScaleBinding } from "@sugarcube-sh/core/client";
import { useSnapshot } from "../store/hooks";
import { getScaleExtension } from "../tokens/scale-extension";
import { DirectScaleControl } from "./DirectScaleControl";
import { RecipeScalePreview } from "./RecipeScalePreview";
import { stripTrailingGlob } from "./path-utils";

type ScaleControlProps = {
    binding: ScaleBinding;
};

/**
 * Dispatches between the two editing models for a `type: "scale"` binding:
 *
 * - When the bound token group has a `sh.sugarcube.scale` recipe → recipe
 *   preview (interactive recipe controls follow in a later commit).
 * - Otherwise → direct controls (base + spread sliders) for tuning the
 *   scale's concrete tokens.
 */
export function ScaleControl({ binding }: ScaleControlProps) {
    const parent = stripTrailingGlob(binding.token);
    const snapshot = useSnapshot();
    const recipe = getScaleExtension(snapshot.trees, parent);

    if (recipe) {
        return <RecipeScalePreview extension={recipe} />;
    }

    return <DirectScaleControl binding={binding} />;
}
