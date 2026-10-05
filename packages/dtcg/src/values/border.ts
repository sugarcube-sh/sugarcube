import { type Described, object, token } from "./shape.js";

export const border = object({
    color: { shape: token("color") },
    width: { shape: token("dimension") },
    style: { shape: token("strokeStyle") },
}) satisfies Described<"border">;
