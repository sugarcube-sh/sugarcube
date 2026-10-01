import type { Generator } from "@sugarcube-sh/dtcg";
import { SUGARCUBE_NAMESPACE } from "../extensions.js";
import { calculateScale } from "./calculator.js";
import { readScaleRecipe } from "./recipe.js";

export const scaleGenerator: Generator = {
    extension: [SUGARCUBE_NAMESPACE, "scale"],
    generate: (_group, extension) => {
        const recipe = readScaleRecipe(extension);
        if (!recipe.ok) return recipe;
        return {
            ok: true,
            value: calculateScale(recipe.value).map(({ name, min, max }) => ({
                name,
                $type: "dimension",
                $value: max,
                $extensions: { [SUGARCUBE_NAMESPACE]: { fluid: { min, max } } },
            })),
        };
    },
};
