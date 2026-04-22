import type { CSSRenderer } from "../../../types/render.js";
import type { TokenType } from "../../../types/tokens.js";
import { renderBorder } from "./border.js";
import { renderColor } from "./color.js";
import { renderCubicBezier } from "./cubic-bezier.js";
import { renderDimension } from "./dimension.js";
import { renderDuration } from "./duration.js";
import { renderFluidDimension } from "./fluid-dimension.js";
import { renderFontFamily } from "./font-family.js";
import { renderFontWeight } from "./font-weight.js";
import { renderGradient } from "./gradient.js";
import { renderNumber } from "./number.js";
import { renderShadow } from "./shadow.js";
import { renderStrokeStyle } from "./stroke.js";
import { renderTransition } from "./transition.js";
import { renderTypography } from "./typography.js";

export const cssRenderers: {
    [T in TokenType]: CSSRenderer<T>;
} = {
    duration: renderDuration,
    number: renderNumber,
    cubicBezier: renderCubicBezier,
    color: renderColor,
    dimension: renderDimension,
    fluidDimension: renderFluidDimension,
    typography: renderTypography,
    border: renderBorder,
    shadow: renderShadow,
    gradient: renderGradient,
    transition: renderTransition,
    strokeStyle: renderStrokeStyle,
    fontFamily: renderFontFamily,
    fontWeight: renderFontWeight,
} as const;
