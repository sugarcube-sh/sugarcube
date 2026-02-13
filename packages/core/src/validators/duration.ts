import { ErrorMessages } from "../constants/error-messages.js";
import type { TokenValidationSchema } from "../types/schema.js";
import type { TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { NumberSchema } from "./number.js";
import { validateSchema } from "./schema-validator.js";

const validUnits = ["ms", "s"] as const;

export const DurationSchema: TokenValidationSchema = {
    tokenType: "duration",
    schema: {
        type: "object",
        errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_DURATION(value, path),
        properties: {
            value: NumberSchema.schema,
            unit: {
                type: "string",
                validate: (value, path, source) => {
                    if (!validUnits.includes(value as any)) {
                        return [
                            {
                                path,
                                message: ErrorMessages.VALIDATE.INVALID_DURATION_UNIT(value, path),
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

export function validateDuration(
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    return validateSchema(DurationSchema.schema, value, path, source);
}
