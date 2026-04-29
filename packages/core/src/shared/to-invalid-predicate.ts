import type { ValidationError } from "../types/validate.js";

/**
 * Returns a function that answers: "is this token broken?"
 *
 * Pass it a list of validation errors and it gives you back a checker.
 * The checker takes a token's path (e.g. `color.primary`) and returns
 * `true` if anything inside that token failed validation.
 *
 * The "anything inside" part matters: an error can point at the token
 * itself (`color.primary`) or at one of its fields (`color.primary.unit`).
 * Both count as the token being broken.
 *
 * If there are no errors, returns `undefined` so callers can skip checking.
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
