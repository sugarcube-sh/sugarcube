import { ErrorMessages } from "../constants/error-messages.js";
import type { TokenValidationSchema } from "../types/schema.js";
import type { TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { validateSchema } from "./schema-validator.js";

export const FontFamilySchema: TokenValidationSchema = {
    tokenType: "fontFamily",
    schema: {
        type: "union",
        oneOf: [
            {
                type: "string",
                errorMessage: (value, path) =>
                    ErrorMessages.VALIDATE.INVALID_FONT_FAMILY(value, path),
            },
            {
                type: "array",
                errorMessage: (value, path) =>
                    ErrorMessages.VALIDATE.INVALID_FONT_FAMILY(value, path),
                validate: (value, path, source) => {
                    const array = value as unknown[];
                    if (!array.every((v) => typeof v === "string")) {
                        return [
                            {
                                path,
                                message: ErrorMessages.VALIDATE.INVALID_FONT_FAMILY(value, path),
                                source,
                            },
                        ];
                    }
                    return [];
                },
            },
        ],
        errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_FONT_FAMILY(value, path),
    },
};

export function validateFontFamily(
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    return validateSchema(FontFamilySchema.schema, value, path, source);
}
