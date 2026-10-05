import { object, ofType } from "./syntax.js";

export const typography = object({
    fontFamily: ofType("fontFamily"),
    fontSize: ofType("dimension"),
    fontWeight: ofType("fontWeight"),
    letterSpacing: ofType("dimension"),
    lineHeight: ofType("number"),
});
