import type { Parse, TokenType, UnresolvedValueByType } from "../index.js";
import { readBorder } from "./border.js";
import { readColor } from "./color.js";
import { readCubicBezier } from "./cubic-bezier.js";
import { readDimension } from "./dimension.js";
import { readDuration } from "./duration.js";
import { readFontFamily } from "./font-family.js";
import { readFontWeight } from "./font-weight.js";
import { readGradient } from "./gradient.js";
import { readNumber } from "./number.js";
import { readShadow } from "./shadow.js";
import { readStrokeStyle } from "./stroke-style.js";
import { readTransition } from "./transition.js";
import { readTypography } from "./typography.js";

export const parsers: { [T in TokenType]: Parse<UnresolvedValueByType[T]> } = {
    color: readColor,
    dimension: readDimension,
    duration: readDuration,
    cubicBezier: readCubicBezier,
    number: readNumber,
    fontFamily: readFontFamily,
    fontWeight: readFontWeight,
    strokeStyle: readStrokeStyle,
    border: readBorder,
    shadow: readShadow,
    gradient: readGradient,
    transition: readTransition,
    typography: readTypography,
};
