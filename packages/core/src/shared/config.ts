import type { InternalConfig, SugarcubeConfig } from "../types/config.js";
import type { ConfigIssue } from "../types/diagnostics.js";
import { ConfigError } from "./config-error.js";
import { DEFAULT_CONFIG } from "./constants/config.js";
import { checkConfig } from "./check-config.js";

/**
 * Adds type checking to the settings in `sugarcube.config.ts`.
 *
 * It returns the config unchanged.
 *
 * @param config - The settings, such as `{ resolver: "./tokens.resolver.json" }`.
 *
 * @see {@link https://sugarcube.sh/docs/reference/configuration-schema/ | Configuration}
 *
 * @example
 * // sugarcube.config.ts
 * import { defineConfig } from "@sugarcube-sh/vite";
 *
 * export default defineConfig({
 *   resolver: "./tokens.resolver.json",
 *   variables: { path: "src/styles/tokens.css" },
 * });
 */
export function defineConfig(config: SugarcubeConfig): SugarcubeConfig {
    return config;
}

/**
 * The folders the default paths go in.
 */
export type DefaultDirs = {
    /** The folder for `variables.path`, `utilities.path` and `cube`, such as `"src/styles"`. */
    stylesDir: string;
    /** The folder for `components`, such as `"src/components/ui"`. */
    componentsDir: string;
};

/**
 * Fills in a config's defaults, using the folders passed in.
 *
 * It reads no files, so it runs in a browser. In Node, `fillDefaults` finds the folders.
 *
 * @param userConfig - The settings, such as `{ resolver: "./tokens.resolver.json" }`.
 * @param dirs - The folders, such as `{ stylesDir: "styles", componentsDir: "components/ui" }`.
 *
 * @example
 * fillDefaultsWithDirs({}, { stylesDir: "styles", componentsDir: "components/ui" }).variables.path
 * // => "styles/variables.gen.css"
 */
export function fillDefaultsWithDirs(
    userConfig: SugarcubeConfig,
    dirs: DefaultDirs,
): InternalConfig {
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

/**
 * Checks a config against the settings sugarcube knows.
 *
 * @param config - The settings, such as `{ resolver: "./tokens.resolver.json" }`.
 * @returns The same object, typed as a config.
 * @throws ConfigError with every mistake found.
 */
export function validateSugarcubeConfig(config: unknown): SugarcubeConfig {
    const issues: ConfigIssue[] = [];
    if (!checkConfig(config, "", issues)) throw new ConfigError(issues);
    return config;
}
