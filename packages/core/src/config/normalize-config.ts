import { DEFAULT_CONFIG } from "../constants/config.js";
import type { InternalConfig, SugarcubeConfig } from "../types/config.js";

/**
 * Fills in default values for any omitted fields in a user configuration.
 *
 * This function takes a user config (with optional fields) and
 * returns a complete internal config (with all required fields filled in).
 *
 * @param userConfig - The user configuration with optional fields
 * @returns A complete configuration with all defaults filled in
 *
 * @example
 * const userConfig = {
 *   resolver: "./tokens.resolver.json"
 * };
 * const completeConfig = fillDefaults(userConfig);
 * // completeConfig.output.cssRoot === "src/styles"
 */
export function fillDefaults(userConfig: SugarcubeConfig): InternalConfig {
    const cssRoot = userConfig.output?.cssRoot ?? DEFAULT_CONFIG.output.cssRoot;

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
        },
    };

    // Only add components path if it's provided or has a default
    if (
        userConfig.output?.components !== undefined ||
        DEFAULT_CONFIG.output.components !== undefined
    ) {
        internalConfig.output.components =
            userConfig.output?.components ?? DEFAULT_CONFIG.output.components;
    }

    if (userConfig.utilities) {
        internalConfig.utilities = userConfig.utilities;
    }

    return internalConfig;
}
