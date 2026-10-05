import { type Described, object, token } from "./shape.js";

export const transition = object({
    duration: { shape: token("duration") },
    delay: { shape: token("duration") },
    timingFunction: { shape: token("cubicBezier") },
}) satisfies Described<"transition">;
