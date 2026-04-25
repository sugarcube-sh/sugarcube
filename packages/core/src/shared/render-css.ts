import type {
    CSSProperties,
    CSSRenderOptions,
    CSSRenderer,
    RenderableToken,
} from "../types/render.js";
import type { TokenType, TokenValue } from "../types/tokens.js";
import { cssRenderers } from "./renderers/css/index.js";

/**
 * Turn a token into its final CSS value (e.g. a color into `oklch(...)`).
 *
 * Called by the CSS writer right before it writes the value out. Each
 * token type (color, dimension, etc.) has its own renderer in the
 * registry — this just picks the right one and runs it. Other output
 * formats (JS, SCSS) will get their own `renderJS` / `renderSCSS`
 * sibling to this file.
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
