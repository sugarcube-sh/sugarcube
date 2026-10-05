import { type Described, elements, forms, object, refuse, token } from "./shape.js";

export const stop = object({
    color: token("color"),
    position: token("number", (position) => Math.min(1, Math.max(0, position))),
});

export const gradient = forms({
    array: elements(stop, "no-gradient-stops"),
    other: refuse("wrong-shape"),
}) satisfies Described<"gradient">;
