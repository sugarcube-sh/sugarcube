import { ErrorMessages } from "../constants/error-messages.js";
import type { ObjectSchema, TokenValidationSchema } from "../types/schema.js";
import type { TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { NumberSchema } from "./number.js";
import { validateSchema } from "./schema-validator.js";

export const DimensionSchema: TokenValidationSchema = {
    tokenType: "dimension",
    schema: {
        type: "object",
        errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_DIMENSION(value, path),
        properties: {
            value: NumberSchema.schema,
            unit: {
                type: "string",
                validate: (value, path, source) => {
                    if (typeof value !== "string" || !["px", "rem"].includes(value)) {
                        return [
                            {
                                path,
                                message: ErrorMessages.VALIDATE.INVALID_DIMENSION_UNIT(value, path),
                                source,
                            },
                        ];
                    }
                    return [];
                },
            },
        },
        required: ["value", "unit"],
    },
};

const FluidExtensionSchema: ObjectSchema = {
    type: "object",
    errorMessage: (value: unknown, path: string) =>
        ErrorMessages.VALIDATE.INVALID_FLUID_DIMENSION(value, path),
    properties: {
        min: DimensionSchema.schema,
        max: DimensionSchema.schema,
    },
    required: ["min", "max"],
};

export function validateDimension(
    value: unknown,
    path: string,
    source: TokenSource,
    extensions?: { [key: string]: unknown }
): ValidationError[] {
    const errors = validateSchema(DimensionSchema.schema, value, path, source);

    const fluid = (extensions?.["sh.sugarcube"] as { fluid?: unknown } | undefined)?.fluid;
    if (fluid) {
        errors.push(
            ...validateSchema(
                FluidExtensionSchema,
                fluid,
                `${path}.$extensions.sh.sugarcube.fluid`,
                source
            )
        );
    }

    return errors;
}
