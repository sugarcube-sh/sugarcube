import { ErrorMessages } from "../constants/error-messages.js";
import type { TokenValidationSchema } from "../types/schema.js";
import type { TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { validateSchema } from "./schema-validator.js";

export const CubicBezierSchema: TokenValidationSchema = {
    tokenType: "cubicBezier",
    schema: {
        type: "array",
        errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_CUBIC_BEZIER(value, path),
        validate: (value, path, source) => {
            const array = value as unknown[];

            if (array.length !== 4 || !array.every((v) => typeof v === "number")) {
                return [
                    {
                        path,
                        message: ErrorMessages.VALIDATE.INVALID_CUBIC_BEZIER(value, path),
                        source,
                    },
                ];
            }

            const [x1, , x2] = array as [number, number, number, number];
            if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
                return [
                    {
                        path,
                        message: ErrorMessages.VALIDATE.INVALID_CUBIC_BEZIER(value, path),
                        source,
                    },
                ];
            }

            return [];
        },
    },
};

export function validateCubicBezier(
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    return validateSchema(CubicBezierSchema.schema, value, path, source);
}
