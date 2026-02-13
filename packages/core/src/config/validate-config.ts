import { ErrorMessages } from "../constants/error-messages.js";
import { internalConfigSchema, userConfigSchema } from "../schemas/config.js";
import type { InternalConfig, SugarcubeConfig } from "../types/config.js";
import { fillDefaults } from "./normalize-config.js";

/**
 * Validates a user configuration object against the user schema.
 *
 * @param config - The user configuration object to validate
 * @returns The validated user configuration
 * @throws Error if the configuration is invalid
 */
export function validateSugarcubeConfig(config: Partial<SugarcubeConfig>): SugarcubeConfig {
    const userResult = userConfigSchema.safeParse(config);

    if (!userResult.success) {
        const errors = userResult.error.errors.map((err) => {
            const path = err.path.join(".");
            return ErrorMessages.CONFIG.INVALID_CONFIG(path || "root", err.message);
        });

        throw new Error(errors.join("\n"));
    }

    return userResult.data;
}

/**
 * Validates an internal configuration object against the internal schema.
 *
 * @param config - The internal configuration object to validate
 * @returns The validated internal configuration
 * @throws Error if the configuration is invalid
 */
export function validateInternalConfig(config: InternalConfig): InternalConfig {
    const internalResult = internalConfigSchema.safeParse(config);

    if (!internalResult.success) {
        const errors = internalResult.error.errors.map((err) => {
            const path = err.path.join(".");
            return ErrorMessages.CONFIG.INVALID_CONFIG(path || "root", err.message);
        });

        throw new Error(errors.join("\n"));
    }

    return internalResult.data;
}

/**
 * Validates a user configuration object against the schema and fills in defaults.
 *
 * @param config - The user configuration object to validate
 * @returns The validated configuration with defaults filled in
 * @throws Error if the configuration is invalid
 *
 * @example
 * const config = { resolver: "./tokens.resolver.json" };
 * const validatedConfig = validateConfig(config);
 */
export function validateConfig(config: Partial<SugarcubeConfig>): InternalConfig {
    const userConfig = validateSugarcubeConfig(config);
    const internalConfig = fillDefaults(userConfig);
    return validateInternalConfig(internalConfig);
}

