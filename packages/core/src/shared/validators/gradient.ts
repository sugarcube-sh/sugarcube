import type { ObjectSchema, TokenValidationSchema } from "../../types/schema.js";
import type { TokenSource } from "../../types/tokens.js";
import type { ValidationError } from "../../types/validate.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { ColorSchema } from "./color.js";
import { validateSchema } from "./schema-validator.js";

const GradientStopSchema: ObjectSchema = {
    type: "object",
    errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_GRADIENT(value, path),
    properties: {
        color: ColorSchema.schema,
        position: { type: "number" },
    },
    required: ["color", "position"],
};

const GradientSchema: TokenValidationSchema = {
    tokenType: "gradient",
    schema: {
        type: "array",
        errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_ARRAY(value, path),
        validate: (value, path, source) => {
            const array = value as unknown[];
            const errors: ValidationError[] = [];

            array.forEach((stop, index) => {
                errors.push(
                    ...validateSchema(GradientStopSchema, stop, `${path}[${index}]`, source),
                );
            });

            return errors;
        },
    },
};

export function validateGradient(
    value: unknown,
    path: string,
    source: TokenSource,
): ValidationError[] {
    return validateSchema(GradientSchema.schema, value, path, source);
}
