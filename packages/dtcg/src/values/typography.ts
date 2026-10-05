import { type Described, object, token } from "./shape.js";

export const typography = object({
    fontFamily: { shape: token("fontFamily") },
    fontSize: { shape: token("dimension") },
    fontWeight: { shape: token("fontWeight") },
    letterSpacing: { shape: token("dimension") },
    lineHeight: { shape: token("number") },
}) satisfies Described<"typography">;
