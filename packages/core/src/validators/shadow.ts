import { ErrorMessages } from "../constants/error-messages.js";
import type { TokenValidationSchema } from "../types/schema.js";
import type { TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { ColorSchema } from "./color.js";
import { DimensionSchema } from "./dimension.js";
import { validateSchema } from "./schema-validator.js";

const ShadowSchema: TokenValidationSchema = {
    tokenType: "shadow",
    schema: {
        type: "object",
        properties: {
            color: {
                type: "union",
                oneOf: [ColorSchema.schema],
            },
            offsetX: DimensionSchema.schema,
            offsetY: DimensionSchema.schema,
            blur: DimensionSchema.schema,
            spread: DimensionSchema.schema,
            inset: {
                type: "boolean",
                errorMessage: (value, path) =>
                    ErrorMessages.VALIDATE.INVALID_SHADOW_INSET(value, path),
            },
        },
        required: ["color", "offsetX", "offsetY", "blur", "spread"],
        errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_SHADOW(value, path),
    },
};

export function validateShadow(
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    const errors: ValidationError[] = [];

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            errors.push(...validateSchema(ShadowSchema.schema, item, `${path}[${index}]`, source));
        });
        return errors;
    }

    return validateSchema(ShadowSchema.schema, value, path, source);
}
