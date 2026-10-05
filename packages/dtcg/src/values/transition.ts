import { object, ofType } from "./syntax.js";

export const transition = object({
    duration: ofType("duration"),
    delay: ofType("duration"),
    timingFunction: ofType("cubicBezier"),
});
