import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { InternalConfig, SugarcubeConfig } from "../types/config.js";
import { fillDefaultsCore } from "./fill-defaults-core.js";

// Re-export the pure helpers so existing imports of fillDefaults from this
// file continue to work, and so consumers can grab the type from one place.
export { fillDefaultsCore } from "./fill-defaults-core.js";
export type { DefaultDirs } from "./fill-defaults-core.js";

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
 * Node-only — uses `existsSync` to detect the `src/` directory. For
 * browser/edge/worker contexts, use `fillDefaultsCore` directly with explicit
 * directory parameters.
 *
 * @param userConfig - The user configuration with optional fields
 * @param cwd - The project root used for `src/` detection (defaults to `process.cwd()`)
 * @returns A complete configuration with all defaults filled in
 */
export function fillDefaults(
    userConfig: SugarcubeConfig,
    cwd: string = process.cwd()
): InternalConfig {
    return fillDefaultsCore(userConfig, {
        stylesDir: getDefaultStylesDir(cwd),
        componentsDir: getDefaultComponentsDir(cwd),
    });
}
