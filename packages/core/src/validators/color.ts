import { isDTCGColorValue, validateDTCGColorValue } from "../color/color-validation.js";
import { ErrorMessages } from "../constants/error-messages.js";
import type { TokenValidationSchema } from "../types/schema.js";
import type { TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { validateSchema } from "./schema-validator.js";

export const ColorSchema: TokenValidationSchema = {
    tokenType: "color",
    schema: {
        type: "union",
        oneOf: [
            {
                type: "string",
                validate: (value, path, source) => {
                    if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/.test(value as string)) {
                        return [
                            {
                                path,
                                message: ErrorMessages.VALIDATE.INVALID_COLOR(value, path),
                                source,
                            },
                        ];
                    }
                    return [];
                },
            },
            {
                type: "object",
                required: ["colorSpace", "components"],
                properties: {
                    colorSpace: { type: "string" },
                    components: { type: "array" },
                    alpha: { type: "number" },
                    hex: { type: "string" },
                },
                validate: (value, path, source) => {
                    if (!isDTCGColorValue(value)) {
                        return [
                            {
                                path,
                                message: ErrorMessages.VALIDATE.INVALID_COLOR(value, path),
                                source,
                            },
                        ];
                    }

                    const dtcgErrors = validateDTCGColorValue(value);
                    return dtcgErrors.map((errorMsg) => ({
                        path,
                        message: `Invalid color at ${path}: ${errorMsg}`,
                        source,
                    }));
                },
            },
        ],
    },
};

export function validateColor(
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    return validateSchema(ColorSchema.schema, value, path, source);
}
