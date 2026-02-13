import { ErrorMessages } from "../constants/error-messages.js";
import type { TokenValidationSchema } from "../types/schema.js";
import type { TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { ColorSchema } from "./color.js";
import { DimensionSchema } from "./dimension.js";
import { validateSchema } from "./schema-validator.js";
import { StrokeStyleSchema } from "./stroke.js";

const BorderSchema: TokenValidationSchema = {
    tokenType: "border",
    schema: {
        type: "object",
        properties: {
            color: ColorSchema.schema,
            width: DimensionSchema.schema,
            style: StrokeStyleSchema.schema,
        },
        required: ["color", "width", "style"],
        errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_BORDER(value, path),
    },
};

export function validateBorder(
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    return validateSchema(BorderSchema.schema, value, path, source);
}
