import { ErrorMessages } from "../constants/error-messages.js";
import type { TokenValidationSchema } from "../types/schema.js";
import type { TokenSource } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { DimensionSchema } from "./dimension.js";
import { FontFamilySchema } from "./font-family.js";
import { FontWeightSchema } from "./font-weight.js";
import { NumberSchema } from "./number.js";
import { validateSchema } from "./schema-validator.js";

const TypographySchema: TokenValidationSchema = {
    tokenType: "typography",
    schema: {
        type: "object",
        properties: {
            fontFamily: FontFamilySchema.schema,
            fontSize: DimensionSchema.schema,
            letterSpacing: DimensionSchema.schema,
            lineHeight: NumberSchema.schema,
            fontWeight: FontWeightSchema.schema,
        },
        required: ["fontFamily", "fontSize"],
        errorMessage: (value, path) => ErrorMessages.VALIDATE.INVALID_TYPOGRAPHY(value, path),
    },
};

export function validateTypography(
    value: unknown,
    path: string,
    source: TokenSource
): ValidationError[] {
    return validateSchema(TypographySchema.schema, value, path, source);
}
