import type { InternalConfig, SugarcubeConfig } from "../types/config.js";
import { DEFAULT_CONFIG } from "./constants/config.js";
import { ErrorMessages } from "./constants/error-messages.js";
import { internalConfigSchema, userConfigSchema } from "./schemas/config.js";

// ============================================
// defineConfig — type-inferred config helper
// ============================================

/**
 * Define a sugarcube configuration with full type inference.
 *
 * @example
 * ```ts
 * // sugarcube.config.ts
 * import { defineConfig } from "@sugarcube-sh/cli";
 *
 * export default defineConfig({
 *   resolver: "./tokens/resolver.json",
 *   variables: { path: "src/styles/tokens.css" }
 * });
 * ```
 */
export function defineConfig(config: SugarcubeConfig): SugarcubeConfig {
    return config;
}

// ============================================
// fillDefaultsCore — environment-agnostic defaults
// ============================================

/**
 * Default directories for path defaults. Callers in non-Node environments
 * (browser, edge, workers) construct one of these manually instead of
 * relying on filesystem detection.
 */
export type DefaultDirs = {
    /** Directory used for default `variables.path` and `utilities.path`, and `cube` */
    stylesDir: string;
    /** Directory used for default `components` */
    componentsDir: string;
};

/**
 * Pure, environment-agnostic version of `fillDefaults`. Takes the default
 * directories explicitly instead of detecting them from the filesystem,
 * making this safe to use in browsers, workers, edge functions, etc.
 *
 * The Node-coupled `fillDefaults` (in `node/config/normalize.ts`) is a thin
 * wrapper around this function that handles `src/` detection via `existsSync`.
 */
export function fillDefaultsCore(userConfig: SugarcubeConfig, dirs: DefaultDirs): InternalConfig {
    const { stylesDir, componentsDir } = dirs;

    const defaultVariablesPath = `${stylesDir}/${DEFAULT_CONFIG.variables.filename}`;
    const defaultUtilitiesPath = `${stylesDir}/${DEFAULT_CONFIG.utilities.filename}`;

    const internalConfig: InternalConfig = {
        resolver: userConfig.resolver,

        variables: {
            path: userConfig.variables?.path ?? defaultVariablesPath,
            prefix: userConfig.variables?.prefix,
            layer: userConfig.variables?.layer,
            transforms: {
                fluid:
                    userConfig.variables?.transforms?.fluid ??
                    DEFAULT_CONFIG.variables.transforms.fluid,
                colorFallbackStrategy:
                    userConfig.variables?.transforms?.colorFallbackStrategy ??
                    DEFAULT_CONFIG.variables.transforms.colorFallbackStrategy,
            },
            permutations: userConfig.variables?.permutations,
        },

        utilities: {
            path: userConfig.utilities?.path ?? defaultUtilitiesPath,
            layer: userConfig.utilities?.layer,
            classes: userConfig.utilities?.classes,
        },

        components: userConfig.components ?? componentsDir,

        cube: userConfig.cube ?? stylesDir,

        studio: userConfig.studio,
    };

    return internalConfig;
}

// ============================================
// Validators
// ============================================

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
 * Environment-agnostic. Pure — takes the default directories explicitly. For
 * Node callers that want `src/` detection, use `validateConfigWithDefaults`
 * from the Node entry (or pass `DEFAULT_DIRS` manually).
 *
 * @param config - The user configuration object to validate
 * @param dirs - Default directories to use when filling defaults
 * @returns The validated configuration with defaults filled in
 * @throws Error if the configuration is invalid
 */
export function validateConfig(
    config: Partial<SugarcubeConfig>,
    dirs: DefaultDirs
): InternalConfig {
    const userConfig = validateSugarcubeConfig(config);
    const internalConfig = fillDefaultsCore(userConfig, dirs);
    return validateInternalConfig(internalConfig);
}
