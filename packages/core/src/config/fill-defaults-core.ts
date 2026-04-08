import { DEFAULT_CONFIG } from "../constants/config.js";
import type { InternalConfig, SugarcubeConfig } from "../types/config.js";

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
 * The Node-coupled `fillDefaults` (in `normalize-config.ts`) is a thin
 * wrapper around this function that handles `src/` detection via
 * `existsSync`.
 *
 * @param userConfig - The user configuration with optional fields
 * @param dirs - The default directories to use for path defaults
 * @returns A complete configuration with all defaults filled in
 */
export function fillDefaultsCore(userConfig: SugarcubeConfig, dirs: DefaultDirs): InternalConfig {
    const { stylesDir, componentsDir } = dirs;

    const defaultVariablesPath = `${stylesDir}/${DEFAULT_CONFIG.variables.filename}`;
    const defaultUtilitiesPath = `${stylesDir}/${DEFAULT_CONFIG.utilities.filename}`;

    const internalConfig: InternalConfig = {
        resolver: userConfig.resolver,

        variables: {
            path: userConfig.variables?.path ?? defaultVariablesPath,
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
    };

    return internalConfig;
}
