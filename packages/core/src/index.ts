/**
 * Node entry point for @sugarcube-sh/core.
 *
 * Exports everything the browser/client entry exports, plus Node-only
 * additions (file loaders, writers) and Node-flavoured
 * overrides (one-arg `validateConfig` / `fillDefaults` that auto-detect
 * default directories via the filesystem).
 *
 * For browser/worker/edge contexts, import from `@sugarcube-sh/core/client`.
 */

// Full browser/pure surface (orchestrators, pure config helpers, types, guards, etc.)
export * from "./client.js";

export { fillDefaults, validateConfig } from "./node/config/normalize.js";
export { configFileExists, isNoConfigError, loadInternalConfig } from "./node/config/load.js";
export type { ConfigOverrides, LoadedConfig } from "./node/config/load.js";

export { findResolverDocument } from "./node/resolver/find.js";
export type { ResolverDiscoveryResult } from "./node/resolver/find.js";

export { loadTokens } from "./node/load-tokens.js";
export type { LoadResult } from "./node/load-tokens.js";
export { createChangeQueue } from "./shared/scheduling.js";
export type { ChangeQueue, ChangeQueueCallbacks } from "./shared/scheduling.js";

export { writeCSSFiles } from "./node/write-css.js";

export { problemCount, problemLines, problemsText } from "./shared/problems.js";
export type { Where } from "./shared/problems.js";
export { plural } from "./shared/plural.js";
