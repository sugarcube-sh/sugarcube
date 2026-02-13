import type { TokenConverter } from "../types/convert.js";
import type { TokenType } from "../types/tokens.js";
import { convertBorderToken } from "./border.js";
import { convertColorToken } from "./color.js";
import { convertCubicBezierToken } from "./cubic-bezier.js";
import { convertDimensionToken } from "./dimension.js";
import { convertDurationToken } from "./duration.js";
import { convertFluidDimensionToken } from "./fluid-dimension.js";
import { convertFontFamilyToken } from "./font-family.js";
import { convertFontWeightToken } from "./font-weight.js";
import { convertGradientToken } from "./gradient.js";
import { convertNumberToken } from "./number.js";
import { convertShadowToken } from "./shadow.js";
import { convertStrokeStyleToken } from "./stroke.js";
import { convertTransitionToken } from "./transition.js";
import { convertTypographyToken } from "./typography.js";

export const converters: {
    [T in TokenType]: TokenConverter<T>;
} = {
    duration: convertDurationToken,
    number: convertNumberToken,
    cubicBezier: convertCubicBezierToken,
    color: convertColorToken,
    dimension: convertDimensionToken,
    fluidDimension: convertFluidDimensionToken,
    typography: convertTypographyToken,
    border: convertBorderToken,
    shadow: convertShadowToken,
    gradient: convertGradientToken,
    transition: convertTransitionToken,
    strokeStyle: convertStrokeStyleToken,
    fontFamily: convertFontFamilyToken,
    fontWeight: convertFontWeightToken,
} as const;
