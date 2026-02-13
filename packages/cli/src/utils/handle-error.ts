import colors from "picocolors";
import { errorBoxWithBadge } from "../prompts/box-with-badge.js";
import { log } from "../prompts/log.js";
import { CLIError } from "../types/index.js";

export function handleError(error: unknown) {
    if (error instanceof CLIError) {
        log.space(1);
        errorBoxWithBadge(error.message, {});
    } else {
        const errorMessage = `An unexpected error occurred: ${
            error instanceof Error ? error.message : String(error)
        }\n\nIf this issue persists, please report it: ${colors.cyan(
            "https://github.com/sugarcube-sh/sugarcube/issues"
        )}`;

        log.space(1);
        errorBoxWithBadge(errorMessage, {});
    }

    process.exit(1);
}
