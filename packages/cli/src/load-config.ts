import { type InternalConfig, loadInternalConfig } from "@sugarcube-sh/core";
import { CLIError } from "./cli-error.js";
import { ERROR_MESSAGES } from "./constants/error-messages.js";

/**
 * This only throws when there are no tokens to be found at all (e.g. a missing resolver)
 * For example, user runs `lint` or `analyze` but the CLI can't find any tokens to lint or analyze.
 * Need it for that reason.
 */
export async function loadTokenConfigOrThrow(command: string): Promise<InternalConfig> {
    try {
        const { config } = await loadInternalConfig();
        return config;
    } catch {
        throw new CLIError(ERROR_MESSAGES.NO_TOKENS_FOR_COMMAND(command));
    }
}
