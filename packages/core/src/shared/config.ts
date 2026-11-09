import type { InternalConfig, SugarcubeConfig } from "../types/config.js";
import type { ConfigIssue } from "../types/diagnostics.js";
import { ConfigError } from "./config-error.js";
import { DEFAULT_CONFIG } from "./constants/config.js";
import { checkConfig } from "./check-config.js";

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
            case: userConfig.variables?.case,
            delimiter: userConfig.variables?.delimiter,
            variableName: userConfig.variables?.variableName,
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
            redeclareDependents: userConfig.variables?.redeclareDependents,
            propagateDependents: userConfig.variables?.propagateDependents,
        },

        utilities: {
            path: userConfig.utilities?.path ?? defaultUtilitiesPath,
            layer: userConfig.utilities?.layer,
            classes: userConfig.utilities?.classes,
        },

        content: userConfig.content,

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
 * Checks a configuration object against the settings sugarcube knows.
 *
 * @param config - The configuration object to check
 * @returns The same object, typed as a configuration
 * @throws ConfigError with every mistake found, if there are any
 */
export function validateSugarcubeConfig(config: unknown): SugarcubeConfig {
    const issues: ConfigIssue[] = [];
    if (!checkConfig(config, "", issues)) throw new ConfigError(issues);
    return config;
}
