import type { ColorFallbackStrategy, FluidConfig } from "./config.js";
import type { SugarcubeExtensions } from "./extensions.js";
import type { ResolvedToken, ResolvedTokens } from "./resolve.js";
import type {
    AlwaysDecomposedType,
    NodeMetadata,
    SimpleTokenType,
    StructuralCompositeType,
    TokenType,
    TokenValue,
} from "./tokens.js";

/**
 * Options passed to CSS renderers at emit time. Swift/JS/etc. would each
 * define their own option type containing format-specific settings.
 */
export interface CSSRenderOptions {
    fluidConfig: FluidConfig;
    colorFallbackStrategy: ColorFallbackStrategy;
    path?: string;
    resolvedTokens?: ResolvedTokens;
    extensions?: SugarcubeExtensions;
}

/** Renders a token value to CSS properties. One implementation per TokenType. */
export type CSSRenderer<T extends TokenType> = (
    value: TokenValue<T>,
    options: CSSRenderOptions
) => CSSProperties<T>;

/**
 * Per-format output names for a token. Today CSS is the only format populated;
 * future formats (js, scss, …) will add their own keys.
 *
 * Computed once during the pipeline and read by every emission site so
 * declarations, references, and utility classes cannot drift apart.
 */
export type TokenNames = {
    css: string;
};

/**
 * A resolved token enriched with format-specific output metadata.
 *
 * `$resolvedValue` lives on `ResolvedToken` (the resolver's observable output)
 * and is omitted here — render-stage consumers only care about `$value`
 * (which preserves references for CSS `var(--…)` emission) and the format-
 * specific metadata added at this step (currently just `$names`).
 */
export type RenderableToken<T extends TokenType = TokenType> = Omit<
    ResolvedToken<T>,
    "$resolvedValue"
> & {
    $names: TokenNames;
};

export type RenderableTokens = {
    [lookupKey: string]: RenderableToken | NodeMetadata;
};

/**
 * Tokens enriched with format-specific output metadata, organized by context.
 * Each context (e.g., "default", "dark") maps to its render-ready tokens.
 */
export type NormalizedRenderableTokens = {
    [context: string]: RenderableTokens;
};

export type CSSProperties<T extends TokenType> = T extends SimpleTokenType
    ? SimpleCSSProperties
    : T extends AlwaysDecomposedType
      ? AlwaysDecomposedProperties
      : T extends "border"
        ? CSSBorderProperties
        : T extends "shadow"
          ? CSSShadowProperties
          : T extends "gradient"
            ? CSSGradientProperties
            : T extends "transition"
              ? CSSTransitionProperties
              : T extends StructuralCompositeType
                ? SimpleCSSProperties
                : never;

export type SimpleCSSProperties = {
    value: string | number;
    /** Feature queries for progressive enhancement (e.g., P3 colors). */
    featureValues?: Array<{
        query: string;
        value: string;
    }>;
};

type AlwaysDecomposedProperties = CSSTypographyProperties;

export type CSSTypographyProperties = {
    "font-family": string;
    "font-size": string;
    "font-weight"?: number | string;
    "letter-spacing"?: string;
    "line-height"?: number | string;
};

export type CSSBorderProperties = { value: string };
export type CSSShadowProperties = { value: string };
export type CSSGradientProperties = { value: string };
export type CSSTransitionProperties = { value: string };
