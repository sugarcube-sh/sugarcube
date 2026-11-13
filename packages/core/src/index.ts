/**
 * Everything in `@sugarcube-sh/core/client`, plus the functions that read and write files in Node.
 *
 * In a browser, use `@sugarcube-sh/core/client`.
 */

// Full browser/pure surface (orchestrators, pure config helpers, types, guards, etc.)
export * from "./client.js";

export { fillDefaults } from "./node/config/normalize.js";
export {
    configFileExists,
    isConfigFile,
    isNoConfigError,
    loadInternalConfig,
} from "./node/config/load.js";
export type { ConfigOverrides, LoadedConfig } from "./node/config/load.js";
export { getTokensOnDisk } from "./node/tokens-on-disk.js";

export { createChangeQueue } from "./shared/scheduling.js";

export { writeCSSFiles } from "./node/write-css.js";

export { pluralize } from "./shared/plural.js";
