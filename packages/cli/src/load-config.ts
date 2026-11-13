import { type LoadedConfig, isNoConfigError, loadInternalConfig } from "@sugarcube-sh/core";
import { CLIError } from "./cli-error.js";
import { ErrorMessages } from "./constants/error-messages.js";

/**
 * Loads the config for a command that needs tokens.
 *
 * If no resolver is found, it throws an error that names the command.
 *
 * @param command - The command, such as `"lint"`.
 */
export async function loadTokenConfigOrThrow(command: string): Promise<LoadedConfig> {
    try {
        return await loadInternalConfig();
    } catch (error) {
        if (isNoConfigError(error))
            throw new CLIError(ErrorMessages.NO_TOKENS_FOR_COMMAND(command));
        throw error;
    }
}
