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

export interface ConversionOptions {
    fluidConfig: FluidConfig;
    colorFallbackStrategy: ColorFallbackStrategy;
    path?: string;
    resolvedTokens?: ResolvedTokens;
    extensions?: SugarcubeExtensions;
}

/** Converts a token value to CSS properties. */
export type TokenConverter<T extends TokenType> = (
    value: TokenValue<T>,
    options: ConversionOptions
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

export type ConvertedToken<T extends TokenType = TokenType> = ResolvedToken<T> & {
    $cssProperties: CSSProperties<T>;
    $names: TokenNames;
};

export type ConvertedTokens = {
    [lookupKey: string]: ConvertedToken | NodeMetadata;
};

/**
 * Tokens that have been converted to CSS properties, organized by context.
 * Each context (e.g., "default", "dark") maps to its converted tokens.
 */
export type NormalizedConvertedTokens = {
    [context: string]: ConvertedTokens;
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
