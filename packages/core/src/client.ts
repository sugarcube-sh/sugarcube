/**
 * Browser-safe entry point for @sugarcube-sh/core.
 *
 * Use this in any non-Node context — browsers, web workers, edge functions:
 *
 *     import { convertTokens, generateCSSVariables } from "@sugarcube-sh/core/client";
 *
 * For Node contexts use the main `@sugarcube-sh/core` entry, which adds
 * file loaders, writers, and the Node-side `fillDefaults`.
 */

// Config
export {
    defineConfig,
    fillDefaultsCore,
    validateConfig,
    validateInternalConfig,
    validateSugarcubeConfig,
} from "./shared/config.js";
export type { DefaultDirs } from "./shared/config.js";
export { DEFAULT_CONFIG } from "./shared/constants/config.js";

// Pipeline orchestrators (pure)
export { resolveTokens } from "./shared/resolve-tokens.js";
export type { ResolveResult, ResolveErrors } from "./shared/resolve-tokens.js";
export { convertTokens } from "./shared/convert-tokens.js";
export type { ConvertResult } from "./shared/convert-tokens.js";
export { generateCSSVariables } from "./shared/generate-css-variables.js";

// Utility-class UnoCSS rules
export { convertConfigToUnoRules, clearMatchCache } from "./shared/uno-rules.js";

// Formatting helpers
export { formatCSSVarName } from "./shared/format-css-var-name.js";

// Guards
export { isResolvedToken } from "./shared/guards.js";

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
export type { TokenTree } from "./types/tokens.js";
export type {
    ConvertedToken,
    ConvertedTokens,
    NormalizedConvertedTokens,
} from "./types/convert.js";
export type { CSSFileOutput } from "./types/generate.js";
export type { userConfigSchema } from "./shared/schemas/config.js";

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
