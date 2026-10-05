import type { TokenType } from "../index.js";
import { border } from "./border.js";
import { color } from "./color.js";
import { cubicBezier } from "./cubic-bezier.js";
import { dimension } from "./dimension.js";
import { duration } from "./duration.js";
import { fontFamily } from "./font-family.js";
import { fontWeight } from "./font-weight.js";
import { gradient } from "./gradient.js";
import { number } from "./number.js";
import { shadow } from "./shadow.js";
import type { Described } from "./shape.js";
import { strokeStyle } from "./stroke-style.js";
import { transition } from "./transition.js";
import { typography } from "./typography.js";

export const descriptions: { readonly [T in TokenType]: Described<T> } = {
    color,
    dimension,
    duration,
    cubicBezier,
    number,
    fontFamily,
    fontWeight,
    strokeStyle,
    border,
    shadow,
    gradient,
    transition,
    typography,
};
