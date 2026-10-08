import { ConfigError } from "@sugarcube-sh/core";
import colors from "picocolors";
import { CLIError } from "./cli-error.js";
import { errorBoxWithBadge } from "./prompts/box-with-badge.js";
import { log } from "./prompts/log.js";

export function handleError(error: unknown) {
    if (error instanceof CLIError || error instanceof ConfigError) {
        log.space(1);
        errorBoxWithBadge(error.message, {});
    } else {
        const errorMessage = `An unexpected error occurred: ${
            error instanceof Error ? error.message : String(error)
        }\n\nIf this issue persists, please report it: ${colors.cyan(
            "https://github.com/sugarcube-sh/sugarcube/issues",
        )}`;

        log.space(1);
        errorBoxWithBadge(errorMessage, {});
    }

    process.exit(1);
}
