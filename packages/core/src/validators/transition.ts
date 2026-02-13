import { ErrorMessages } from "../constants/error-messages.js";
import type { TokenValidationSchema } from "../types/schema.js";
import type { TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { CubicBezierSchema } from "./cubic-bezier.js";
import { DurationSchema } from "./duration.js";
import { validateSchema } from "./schema-validator.js";

const TransitionSchema: TokenValidationSchema = {
    tokenType: "transition",
    schema: {
        type: "object",
        properties: {
            duration: DurationSchema.schema,
            delay: DurationSchema.schema,
            timingFunction: CubicBezierSchema.schema,
        },
        required: ["duration", "delay", "timingFunction"],
        errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_TRANSITION(value, path),
    },
};

export function validateTransition(
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    return validateSchema(TransitionSchema.schema, value, path, source);
}
