import { ErrorMessages } from "../constants/error-messages.js";
import type { TokenValidationSchema } from "../types/schema.js";
import type { TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { DimensionSchema } from "./dimension.js";
import { validateSchema } from "./schema-validator.js";

const FluidDimensionSchema: TokenValidationSchema = {
    tokenType: "fluidDimension",
    schema: {
        type: "object",
        errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_FLUID_DIMENSION(value, path),
        properties: {
            min: DimensionSchema.schema,
            max: DimensionSchema.schema,
        },
        required: ["min", "max"],
    },
};

export function validateFluidDimension(
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    return validateSchema(FluidDimensionSchema.schema, value, path, source);
}
