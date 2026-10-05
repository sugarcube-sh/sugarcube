import { type Described, object, token } from "./shape.js";

export const transition = object({
    duration: token("duration"),
    delay: token("duration"),
    timingFunction: token("cubicBezier"),
}) satisfies Described<"transition">;
