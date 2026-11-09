import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
    type DefaultDirs,
    fillDefaultsCore,
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
 * Fills in default values for any omitted fields in a user configuration.
 *
 * Output paths default to `src/styles` or `styles` (and similar) depending on
 * whether a `src/` directory exists in the project root.
 *
 * Node-only. Uses `existsSync` to detect the `src/` directory. For
 * browser/edge/worker contexts, use `fillDefaultsCore` directly with explicit
 * directory parameters.
 */
export function fillDefaults(
    userConfig: SugarcubeConfig,
    cwd: string = process.cwd(),
): InternalConfig {
    return fillDefaultsCore(userConfig, detectDefaultDirs(cwd));
}

/**
 * Checks a user configuration object and fills in defaults.
 *
 * Node convenience wrapper that auto-detects default directories via the
 * filesystem.
 */
export function validateConfig(config: Partial<SugarcubeConfig>): InternalConfig {
    return fillDefaults(validateSugarcubeConfig(config));
}
