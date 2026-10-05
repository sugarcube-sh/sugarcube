import { type Described, object, token } from "./shape.js";

export const typography = object({
    fontFamily: token("fontFamily"),
    fontSize: token("dimension"),
    fontWeight: token("fontWeight"),
    letterSpacing: token("dimension"),
    lineHeight: token("number"),
}) satisfies Described<"typography">;
