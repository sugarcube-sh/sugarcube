/**
 * Client entry point for @sugarcube-sh/core.
 *
 * Use this entry point in any non-Node context — browsers, web workers,
 * edge functions, the studio dock, or anywhere else without filesystem access:
 *
 *     import { processAndConvertTokens, generateCSSVariables } from "@sugarcube-sh/core/client";
 *
 * For Node contexts (CLI, Vite plugin, build scripts) use the main entry
 * point `@sugarcube-sh/core`, which includes file loaders, writers, and
 * `fillDefaults` (the Node version that detects `src/` via `existsSync`).
 */

// Config
export { defineConfig } from "./define-config.js";
export { DEFAULT_CONFIG } from "./constants/config.js";
export { fillDefaultsCore } from "./config/fill-defaults-core.js";
export type { DefaultDirs } from "./config/fill-defaults-core.js";

// Pipelines (pure transformation orchestrators)
export { processAndConvertTokens } from "./pipelines/process-and-convert.js";

// Generators
export { generateCSSVariables } from "./generators/generate-css-variables.js";

// UnoCSS adapter (pure)
export {
    convertConfigToUnoRules,
    clearMatchCache,
} from "./utils/convert-utility-config-to-uno-rules.js";

// PerfMonitor and Instrumentation are deliberately NOT exported here.
// They use Node-only globals (process.env, process.stderr, process.hrtime,
// process.memoryUsage) and are intended for instrumenting the Node-side
// build pipeline. Browser/client consumers don't need them. If browser
// instrumentation is wanted later, it should be a separate module that
// uses Performance APIs available in non-Node contexts.

// Types
export type {
    InternalConfig,
    SugarcubeConfig,
    ColorFallbackStrategy,
    FluidConfig,
    Permutation,
    VariablesConfig,
    UtilitiesOutputConfig,
    UtilityClassesConfig,
} from "./types/config.js";
export type {
    PipelineContext,
    PipelineEvent,
    PipelineWarning,
    TokenPipelineSource,
} from "./types/pipelines.js";
export { createPipelineContext } from "./types/pipelines.js";
export type { ResolvedTokens } from "./types/resolve.js";
export type { TokenTree } from "./types/tokens.js";
export type {
    ConvertedToken,
    ConvertedTokens,
    NormalizedConvertedTokens,
} from "./types/convert.js";
export type { CSSFileOutput } from "./types/generate.js";
export type { userConfigSchema } from "./schemas/config.js";

// DTCG types — including NodeMetadata, which studio's client currently
// has to redefine locally because it's not exposed from the main entry.
export type {
    NodeMetadata,
    Token,
    TokenGroup,
    TokenType,
    SimpleTokenType,
    AlwaysDecomposedType,
    StructuralCompositeType,
    TokenValue,
    RawTokenValue,
    Dimension,
    FluidDimension,
    Duration,
    FontFamily,
    LineCap,
    StrokeStyleKeyword,
    ShadowObject,
    GradientStop,
    Reference,
    TokenRef,
    GroupRef,
} from "./types/dtcg.js";
