import type {
    CSSProperties,
    CSSRenderOptions,
    CSSRenderer,
    RenderableToken,
} from "../types/render.js";
import type { TokenType, TokenValue } from "../types/tokens.js";
import { cssRenderers } from "./renderers/css/index.js";

/**
 * Render a resolved token to its CSS-shaped value.
 *
 * Invoked by the CSS writer at emission time. This is the seam that lets
 * tokens end the pipeline format-neutral — rendering stops being baked
 * into `$cssProperties` during the convert step and instead becomes a
 * format-owned concern.
 *
 * Dispatches to the CSS renderer registry. Future formats (JS, SCSS,
 * Android) will add their own render function (`renderJS`, etc.) and
 * their own renderer directory alongside this one.
 *
 * `options` carries pipeline-wide settings (fluid config, color-fallback
 * strategy). Per-token state (`$extensions`) is merged in automatically so
 * callers don't have to rebuild options per token.
 */
export function renderCSS<T extends TokenType>(
    token: RenderableToken<T>,
    options: CSSRenderOptions
): CSSProperties<T> {
    const render = cssRenderers[token.$type] as CSSRenderer<T>;
    const finalOptions = token.$extensions
        ? { ...options, extensions: token.$extensions }
        : options;
    return render(token.$value as TokenValue<T>, finalOptions);
}
