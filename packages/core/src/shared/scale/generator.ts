import { type DimensionValue, defineGenerator } from "@sugarcube-sh/dtcg";
import { SUGARCUBE_NAMESPACE } from "../extensions.js";
import { calculateScale } from "./calculator.js";
import { readScaleRecipe } from "./recipe.js";
import { ErrorMessages } from "../constants/error-messages.js";

const asWritten = ({ value, unit }: DimensionValue) => ({ value, unit });

export const scaleGenerator = defineGenerator({
    extension: [SUGARCUBE_NAMESPACE, "scale"],
    messages: ErrorMessages.SCALE_RECIPE,
    generate: (_group, extension, options) => {
        const recipe = readScaleRecipe(extension, options);
        if (!recipe.ok) return recipe;
        return {
            ...recipe,
            value: calculateScale(recipe.value).map(({ name, min, max }) => ({
                name,
                $type: "dimension",
                $value: asWritten(max),
                $extensions: {
                    [SUGARCUBE_NAMESPACE]: { fluid: { min: asWritten(min), max: asWritten(max) } },
                },
            })),
        };
    },
});
