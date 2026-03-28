import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CONFIG } from "../constants/config.js";
import type { InternalConfig, SugarcubeConfig } from "../types/config.js";

function getDefaultStylesDir(cwd: string): string {
    return existsSync(resolve(cwd, "src")) ? "src/styles" : "styles";
}

function getDefaultComponentsDir(cwd: string): string {
    return existsSync(resolve(cwd, "src")) ? "src/components/ui" : "components/ui";
}

/**
 * Fills in default values for any omitted fields in a user configuration.
 *
 * This function takes a user config (with optional fields) and
 * returns a complete internal config (with all required fields filled in).
 *
 * Output paths default to `src/styles` or `styles` (and similar) depending on
 * whether a `src/` directory exists in the project root.
 *
 * @param userConfig - The user configuration with optional fields
 * @param cwd - The project root used for `src/` detection (defaults to `process.cwd()`)
 * @returns A complete configuration with all defaults filled in
 */
export function fillDefaults(
    userConfig: SugarcubeConfig,
    cwd: string = process.cwd()
): InternalConfig {
    const stylesDir = getDefaultStylesDir(cwd);

    // Build default paths
    const defaultVariablesPath = `${stylesDir}/${DEFAULT_CONFIG.variables.filename}`;
    const defaultUtilitiesPath = `${stylesDir}/${DEFAULT_CONFIG.utilities.filename}`;

    const internalConfig: InternalConfig = {
        resolver: userConfig.resolver,

        input: userConfig.input,

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

        components: userConfig.components ?? getDefaultComponentsDir(cwd),

        cube: userConfig.cube ?? stylesDir,
    };

    return internalConfig;
}
