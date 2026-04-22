import type { ValidationError } from "../types/validate.js";

/**
 * Build a `(tokenPath) => boolean` predicate from validation errors.
 *
 * Validation errors may have property-level paths (e.g., `"token.path.unit"`),
 * so the predicate returns `true` if the error's path equals the token path or
 * is nested under it. Used by format-specific name-assigners to drop tokens
 * that failed validation.
 *
 * Returns `undefined` when there are no errors — callers can skip the check.
 */
export function toInvalidPredicate(
    validationErrors?: ValidationError[]
): ((tokenPath: string) => boolean) | undefined {
    if (!validationErrors || validationErrors.length === 0) return undefined;
    return (tokenPath) =>
        validationErrors.some(
            (error) => error.path === tokenPath || error.path.startsWith(`${tokenPath}.`)
        );
}
