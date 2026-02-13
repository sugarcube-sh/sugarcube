import { loadAndResolveTokens } from "@sugarcube-sh/core";
import type { InternalConfig, TokenPipelineSource } from "@sugarcube-sh/core";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { CLIError } from "../types/index.js";

// CLI needs special error handling so we wrap the token processing pipeline
// I considered separating the two but this felt like the right abstraction
export async function loadAndResolveTokensForCLI(
    validatedConfig: InternalConfig,
    memoryData?: Record<string, { set?: string; content: string }>
) {
    let source: TokenPipelineSource;

    if (memoryData) {
        source = { type: "memory", data: memoryData, config: validatedConfig };
    } else {
        if (!validatedConfig.resolver) {
            throw new CLIError(ERROR_MESSAGES.RESOLVER_NOT_CONFIGURED());
        }
        source = {
            type: "resolver",
            resolverPath: validatedConfig.resolver,
            config: validatedConfig,
        };
    }

    const { trees, resolved, modifiers, errors } = await loadAndResolveTokens(source);

    if (errors.load.length > 0) {
        const errorMessages = errors.load.map((error) => {
            const fileName = error.file.split("/").pop() || "unknown file";
            let userMessage = `File ${fileName}: `;

            if (error.message.includes("Unexpected token")) {
                userMessage = ERROR_MESSAGES.TOKEN_FILE_INVALID_JSON(fileName);
            } else if (error.message.includes("Unexpected end")) {
                userMessage = ERROR_MESSAGES.TOKEN_FILE_INCOMPLETE_JSON(fileName);
            } else {
                userMessage = ERROR_MESSAGES.TOKEN_FILE_GENERIC_ERROR(fileName, error.message);
            }

            return userMessage;
        });

        throw new CLIError(ERROR_MESSAGES.TOKEN_LOAD_FAILED(errorMessages));
    }

    if (errors.validation.length > 0 || errors.flatten.length > 0 || errors.resolution.length > 0) {
        const allErrors = [...errors.flatten, ...errors.validation, ...errors.resolution];
        const errorsByFile = new Map<string, string[]>();

        for (const error of allErrors) {
            if (error.source?.sourcePath) {
                const messages = errorsByFile.get(error.source.sourcePath) || [];
                messages.push(error.message);
                errorsByFile.set(error.source.sourcePath, messages);
            }
        }

        throw new CLIError(ERROR_MESSAGES.TOKEN_VALIDATION_FAILED(errorsByFile));
    }

    return { trees, resolved, modifiers };
}
