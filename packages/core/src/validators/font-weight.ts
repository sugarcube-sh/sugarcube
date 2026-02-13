import { ErrorMessages } from "../constants/error-messages.js";
import type { TokenValidationSchema } from "../types/schema.js";
import type { TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { validateSchema } from "./schema-validator.js";

const validStringValues = [
    "thin",
    "hairline",
    "extra-light",
    "ultra-light",
    "light",
    "normal",
    "regular",
    "book",
    "medium",
    "semi-bold",
    "demi-bold",
    "bold",
    "extra-bold",
    "ultra-bold",
    "black",
    "heavy",
    "extra-black",
    "ultra-black",
];

export const FontWeightSchema: TokenValidationSchema = {
    tokenType: "fontWeight",
    schema: {
        type: "union",
        errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_FONT_WEIGHT(value, path),
        oneOf: [
            {
                type: "number",
                errorMessage: (value, path) =>
                    ErrorMessages.VALIDATE.INVALID_FONT_WEIGHT(value, path),
                validate: (value, path, source) => {
                    if ((value as number) < 1 || (value as number) > 1000) {
                        return [
                            {
                                path,
                                message: ErrorMessages.VALIDATE.INVALID_FONT_WEIGHT(value, path),
                                source,
                            },
                        ];
                    }
                    return [];
                },
            },
            {
                type: "string",
                errorMessage: (value, path) =>
                    ErrorMessages.VALIDATE.INVALID_FONT_WEIGHT(value, path),
                validate: (value, path, source) => {
                    if (!validStringValues.includes((value as string).toLowerCase())) {
                        return [
                            {
                                path,
                                message: ErrorMessages.VALIDATE.INVALID_FONT_WEIGHT(value, path),
                                source,
                            },
                        ];
                    }
                    return [];
                },
            },
        ],
    },
};

export function validateFontWeight(
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    return validateSchema(FontWeightSchema.schema, value, path, source);
}
