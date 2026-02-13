import { ErrorMessages } from "../constants/error-messages.js";
import type { TokenValidationSchema } from "../types/schema.js";
import type { TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { validateSchema } from "./schema-validator.js";

export const NumberSchema: TokenValidationSchema = {
    tokenType: "number",
    schema: {
        type: "number",
        errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_NUMBER(value, path),
        validate: (value, path, source) => {
            if (typeof value !== "number" || Number.isNaN(value)) {
                return [
                    {
                        path,
                        message: ErrorMessages.VALIDATE.INVALID_NUMBER(value, path),
                        source,
                    },
                ];
            }
            return [];
        },
    },
};

export function validateNumber(
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    return validateSchema(NumberSchema.schema, value, path, source);
}
