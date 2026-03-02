import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CONFIG } from "../constants/config.js";
import type { InternalConfig, SugarcubeConfig } from "../types/config.js";

function getDefaultCssRoot(cwd: string): string {
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
    const cssRoot = userConfig.output?.cssRoot ?? getDefaultCssRoot(cwd);

    const internalConfig: InternalConfig = {
        resolver: userConfig.resolver,

        transforms: {
            fluid: userConfig.transforms?.fluid ?? DEFAULT_CONFIG.transforms.fluid,
            colorFallbackStrategy:
                userConfig.transforms?.colorFallbackStrategy ??
                DEFAULT_CONFIG.transforms.colorFallbackStrategy,
        },
        output: {
            cssRoot,
            variables: userConfig.output?.variables ?? `${cssRoot}/global`,
            variablesFilename:
                userConfig.output?.variablesFilename ?? DEFAULT_CONFIG.output.variablesFilename,
            utilities: userConfig.output?.utilities ?? `${cssRoot}/utilities`,
            utilitiesFilename:
                userConfig.output?.utilitiesFilename ?? DEFAULT_CONFIG.output.utilitiesFilename,
            cube: userConfig.output?.cube ?? cssRoot,
            themeAttribute:
                userConfig.output?.themeAttribute ?? DEFAULT_CONFIG.output.themeAttribute,
            defaultContext: userConfig.output?.defaultContext,
            layers: userConfig.output?.layers,
        },
    };

    // Only add components path if it's provided or has a default
    if (
        userConfig.output?.components !== undefined ||
        DEFAULT_CONFIG.output.components !== undefined
    ) {
        internalConfig.output.components =
            userConfig.output?.components ?? getDefaultComponentsDir(cwd);
    }

    if (userConfig.utilities) {
        internalConfig.utilities = userConfig.utilities;
    }

    return internalConfig;
}
