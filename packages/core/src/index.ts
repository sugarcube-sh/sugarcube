/**
 * Node entry point for @sugarcube-sh/core.
 *
 * Exports everything the browser/client entry exports, plus Node-only
 * additions (file loaders, writers, perf tooling) and Node-flavoured
 * overrides (one-arg `validateConfig` / `fillDefaults` that auto-detect
 * default directories via the filesystem).
 *
 * For browser/worker/edge contexts, import from `@sugarcube-sh/core/client`.
 */

// Full browser/pure surface (orchestrators, pure config helpers, types, guards, etc.)
export * from "./client.js";

// Node-flavoured config helpers (these override `validateConfig` and add `fillDefaults`)
export { fillDefaults, validateConfig } from "./node/config/normalize.js";
export {
    configFileExists,
    isNoConfigError,
    loadInternalConfig,
    loadSugarcubeConfig,
} from "./node/config/load.js";

// Resolver discovery + static analysis (Node filesystem only)
export { findResolverDocument } from "./node/resolver/find.js";
export type { ResolverDiscoveryResult } from "./node/resolver/find.js";
export { extractFileRefs } from "./node/resolver/extract-refs.js";
export type { ExtractFileRefsResult } from "./node/resolver/extract-refs.js";

// Node loader (the first step of the pipeline — reads from disk)
export { loadTokens } from "./node/load-tokens.js";
export type { LoadResult } from "./node/load-tokens.js";

// Perf / instrumentation (Node-only: uses process.hrtime, process.memoryUsage, etc.)
export { PerfMonitor, Instrumentation } from "./node/perf.js";

// Filesystem writers
export { writeCSSVariablesToDisk, writeCSSUtilitiesToDisk } from "./node/write-css.js";
