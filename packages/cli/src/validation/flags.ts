import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { CLIError } from "../types/errors.js";

/**
 * Validates that a value is a filename, not a path.
 * @throws CLIError if the value contains path separators
 */
export function validateFilename(value: string | undefined, flagName: string): void {
    if (!value) return;

    if (value.includes("/") || value.includes("\\")) {
        throw new CLIError(ERROR_MESSAGES.FILENAME_CONTAINS_PATH(flagName, value));
    }
}
