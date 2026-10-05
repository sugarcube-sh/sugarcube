import { defineGenerator } from "@sugarcube-sh/dtcg";
import { SUGARCUBE_NAMESPACE } from "../extensions.js";
import { calculateScale } from "./calculator.js";
import { readScaleRecipe } from "./recipe.js";
import { ErrorMessages } from "../constants/error-messages.js";

export const scaleGenerator = defineGenerator({
    extension: [SUGARCUBE_NAMESPACE, "scale"],
    messages: ErrorMessages.SCALE_RECIPE,
    generate: (_group, extension) => {
        const recipe = readScaleRecipe(extension);
        if (!recipe.ok) return recipe;
        return {
            ...recipe,
            value: calculateScale(recipe.value).map(({ name, min, max }) => ({
                name,
                $type: "dimension",
                $value: max,
                $extensions: { [SUGARCUBE_NAMESPACE]: { fluid: { min, max } } },
            })),
        };
    },
});
