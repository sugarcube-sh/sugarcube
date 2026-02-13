import { ErrorMessages } from "../constants/error-messages.js";
import type { FlattenedToken, FlattenedTokens } from "../types/flatten.js";
import type { TokenType } from "../types/tokens.js";
import type { ValidationError, Validator } from "../types/validate.js";
import { validateBorder } from "../validators/border.js";
import { validateColor } from "../validators/color.js";
import { validateCubicBezier } from "../validators/cubic-bezier.js";
import { validateDimension } from "../validators/dimension.js";
import { validateDuration } from "../validators/duration.js";
import { validateFluidDimension } from "../validators/fluid-dimension.js";
import { validateFontFamily } from "../validators/font-family.js";
import { validateFontWeight } from "../validators/font-weight.js";
import { validateGradient } from "../validators/gradient.js";
import { validateNumber } from "../validators/number.js";
import { validateShadow } from "../validators/shadow.js";
import { validateStrokeStyle } from "../validators/stroke.js";
import { validateTransition } from "../validators/transition.js";
import { validateTypography } from "../validators/typography.js";

// Map of token types to their corresponding validation functions
// Each validator is responsible for checking the structure and values
// of a specific token type
const validators = {
    // Simple types
    color: validateColor,
    dimension: validateDimension,
    fluidDimension: validateFluidDimension,
    duration: validateDuration,
    cubicBezier: validateCubicBezier,
    fontFamily: validateFontFamily,
    fontWeight: validateFontWeight,
    number: validateNumber,

    // Composite types
    strokeStyle: validateStrokeStyle,
    typography: validateTypography,
    border: validateBorder,
    shadow: validateShadow,
    gradient: validateGradient,
    transition: validateTransition,
} satisfies {
    [K in TokenType]: Validator<K>;
};

/**
 * Validates a set of flattened design tokens against their type definitions.
 *
 * @param tokens - The flattened tokens to validate
 * @returns An array of validation errors, empty if all tokens are valid
 *
 * This function performs two levels of validation:
 * 1. Structural validation - checks for required properties like $type and $value
 * 2. Type-specific validation - uses type-specific validators to check values
 *
 * @example
 * const errors = validate({
 *   tokens: {
 *     "color.primary": {
 *       $type: "color",
 *       $value: "#ff0000",
 *       $path: "color.primary",
 *       $source: { file: "tokens.json" }
 *     }
 *   }
 * });
 */
export function validate(tokens: FlattenedTokens): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [path, node] of Object.entries(tokens.tokens)) {
        if (typeof node !== "object" || node === null) continue;
        if (!("$type" in node) || !("$path" in node)) {
            continue;
        }
        if (node.$path.startsWith("$")) continue;

        // Check for required fields before validation.
        // Validators should only have the responsibility of validating structurally sound tokens.
        // Therefore, the responsibility of checking for required fields should be handled here
        if (!("$value" in node)) {
            errors.push({
                path: (node as { $path: string }).$path,
                message: ErrorMessages.VALIDATE.MISSING_REQUIRED_PROPERTY(
                    "$value",
                    (node as { $path: string }).$path
                ),
                source: (node as { $source: any }).$source,
            });
            continue;
        }

        const validator = validators[node.$type as TokenType];
        if (!validator) {
            errors.push({
                path: node.$path,
                message: ErrorMessages.VALIDATE.UNKNOWN_TOKEN_TYPE(
                    node.$type as TokenType,
                    node.$path
                ),
                source: node.$source,
            });
            continue;
        }

        const flattenedToken = node as FlattenedToken;
        errors.push(
            ...validator(flattenedToken.$value, flattenedToken.$path, flattenedToken.$source)
        );
    }

    return errors;
}
