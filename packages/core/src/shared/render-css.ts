import type {
    CSSProperties,
    ConversionOptions,
    ConvertedToken,
    TokenConverter,
} from "../types/convert.js";
import type { TokenType, TokenValue } from "../types/tokens.js";
import { converters } from "./renderers/css/index.js";

/**
 * Render a resolved token to its CSS-shaped value.
 *
 * Invoked by the CSS writer at emission time. This is the seam that lets
 * tokens end the pipeline format-neutral — rendering stops being baked
 * into `$cssProperties` during the convert step and instead becomes a
 * format-owned concern.
 *
 * Today delegates to the existing converter registry; future formats
 * (JS, SCSS, Android) will add their own render functions alongside
 * this one without changing the pipeline.
 *
 * `options` carries pipeline-wide settings (fluid config, color-fallback
 * strategy). Per-token state (`$extensions`) is merged in automatically so
 * callers don't have to rebuild options per token.
 */
export function renderCSS<T extends TokenType>(
    token: ConvertedToken<T>,
    options: ConversionOptions
): CSSProperties<T> {
    const converter = converters[token.$type] as TokenConverter<T>;
    const finalOptions = token.$extensions
        ? { ...options, extensions: token.$extensions }
        : options;
    return converter(token.$value as TokenValue<T>, finalOptions);
}
