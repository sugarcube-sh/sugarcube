import { type Described, object, token } from "./shape.js";

export const border = object({
    color: token("color"),
    width: token("dimension"),
    style: token("strokeStyle"),
}) satisfies Described<"border">;
