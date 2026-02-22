// Config
export { defineConfig } from "./define-config.js";
export { DEFAULT_CONFIG } from "./constants/config.js";
export {
    configFileExists,
    isNoConfigError,
    loadInternalConfig,
    loadSugarcubeConfig,
} from "./config/load-config.js";
export { validateConfig } from "./config/validate-config.js";
export { fillDefaults } from "./config/normalize-config.js";

// Discovery
export { findResolverDocument } from "./utils/find-resolver.js";
export type { ResolverDiscoveryResult } from "./utils/find-resolver.js";

// Pipelines
export { loadAndResolveTokens } from "./pipelines/load-and-resolve.js";
export { processAndConvertTokens } from "./pipelines/process-and-convert.js";

// Generators
export { generateCSSVariables } from "./generators/generate-css-variables.js";
export {
    convertConfigToUnoRules,
    clearMatchCache,
} from "./utils/convert-utility-config-to-uno-rules.js";

// Utils (for vite plugin)
export { PerfMonitor } from "./utils/perf-monitor.js";
export { Instrumentation } from "./utils/instrumentation.js";

// File writers
export { writeCSSVariablesToDisk, writeCSSUtilitiesToDisk } from "./fs/css-writer.js";

// Types
export type {
    InternalConfig,
    SugarcubeConfig,
    ColorFallbackStrategy,
    FluidConfig,
    LayersConfig,
} from "./types/config.js";
export type { ModifierMeta, TokenPipelineSource } from "./types/pipelines.js";
export type { ResolvedTokens } from "./types/resolve.js";
export type { TokenTree } from "./types/tokens.js";
export type { NormalizedConvertedTokens } from "./types/convert.js";
export type { CSSFileOutput } from "./types/generate.js";
export type { userConfigSchema } from "./schemas/config.js";
