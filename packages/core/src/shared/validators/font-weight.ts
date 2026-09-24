import type { TokenValidationSchema } from "../../types/schema.js";
import type { TokenSource } from "../../types/tokens.js";
import type { ValidationError } from "../../types/validate.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { FONT_WEIGHT_ALIASES } from "../constants/tokens.js";
import { validateSchema } from "./schema-validator.js";

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
                    if (!Object.hasOwn(FONT_WEIGHT_ALIASES, value as string)) {
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
    source: TokenSource,
): ValidationError[] {
    return validateSchema(FontWeightSchema.schema, value, path, source);
}
