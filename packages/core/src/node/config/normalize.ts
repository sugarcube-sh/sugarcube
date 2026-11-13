import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
    type DefaultDirs,
    fillDefaultsWithDirs,
    validateSugarcubeConfig,
} from "../../shared/config.js";
import type { InternalConfig, SugarcubeConfig } from "../../types/config.js";

function getDefaultStylesDir(cwd: string): string {
    return existsSync(resolve(cwd, "src")) ? "src/styles" : "styles";
}

function getDefaultComponentsDir(cwd: string): string {
    return existsSync(resolve(cwd, "src")) ? "src/components/ui" : "components/ui";
}

function detectDefaultDirs(cwd: string = process.cwd()): DefaultDirs {
    return {
        stylesDir: getDefaultStylesDir(cwd),
        componentsDir: getDefaultComponentsDir(cwd),
    };
}

/**
 * Fills in a config's defaults.
 *
 * Output paths go in `src/styles` when the project has a `src` folder, and in `styles` when not.
 * In a browser, use {@link fillDefaultsWithDirs}.
 *
 * @param userConfig - The settings, such as `{ resolver: "./tokens.resolver.json" }`.
 * @param cwd - The project's folder, such as `"/site"`. It's `process.cwd()` when left out.
 *
 * @example
 * // In a project with a src folder
 * fillDefaults({}).variables.path
 * // => "src/styles/variables.gen.css"
 */
export function fillDefaults(
    userConfig: SugarcubeConfig,
    cwd: string = process.cwd(),
): InternalConfig {
    return fillDefaultsWithDirs(userConfig, detectDefaultDirs(cwd));
}

/**
 * Checks a config and fills in its defaults.
 *
 * @param config - The settings, such as `{ resolver: "./tokens.resolver.json" }`.
 * @throws ConfigError if the config has mistakes.
 */
export function validateConfig(config: Partial<SugarcubeConfig>): InternalConfig {
    return fillDefaults(validateSugarcubeConfig(config));
}
