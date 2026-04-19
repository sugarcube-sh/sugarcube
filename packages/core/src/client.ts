/**
 * Browser-safe entry point for @sugarcube-sh/core.
 *
 * Use this in any non-Node context — browsers, web workers, edge functions:
 *
 *     import { processAndConvertTokens, generateCSSVariables } from "@sugarcube-sh/core/client";
 *
 * For Node contexts use the main `@sugarcube-sh/core` entry, which adds
 * file loaders, writers, and the Node-side `fillDefaults`.
 */

export { defineConfig } from "./define-config.js";
export { DEFAULT_CONFIG } from "./constants/config.js";
export { fillDefaultsCore } from "./config/fill-defaults-core.js";
export type { DefaultDirs } from "./config/fill-defaults-core.js";

export { processAndConvertTokens } from "./pipelines/process-and-convert.js";

export { generateCSSVariables } from "./generators/generate-css-variables.js";

export {
    convertConfigToUnoRules,
    clearMatchCache,
} from "./utils/convert-utility-config-to-uno-rules.js";

export { formatCSSVarName } from "./utils/format-css-var-name.js";

export type {
    InternalConfig,
    SugarcubeConfig,
    ColorFallbackStrategy,
    FluidConfig,
    Permutation,
    VariablesConfig,
    UtilitiesOutputConfig,
    UtilityClassesConfig,
    StudioConfig,
    ColorScaleConfig,
    PanelSection,
    BindingSection,
    PanelBinding,
    ColorBinding,
    PresetBinding,
    ScaleBinding,
    ScaleLinkedBinding,
    PaletteSwapBinding,
} from "./types/config.js";
export type {
    PipelineContext,
    PipelineEvent,
    PipelineWarning,
    TokenPipelineSource,
} from "./types/pipelines.js";
export { createPipelineContext } from "./types/pipelines.js";
export type { ResolvedToken, ResolvedTokens } from "./types/resolve.js";
export { isResolvedToken } from "./guards/token-guards.js";
export type { TokenTree } from "./types/tokens.js";
export type {
    ConvertedToken,
    ConvertedTokens,
    NormalizedConvertedTokens,
} from "./types/convert.js";
export type { CSSFileOutput } from "./types/generate.js";
export type { userConfigSchema } from "./schemas/config.js";

// DTCG types
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
