import { type Described, elements, forms, object, token } from "./shape.js";

export const stop = object({
    color: { shape: token("color") },
    position: { shape: token("number", (position) => Math.min(1, Math.max(0, position))) },
});

export const gradient = forms({ array: elements(stop, "no-gradient-stops") }, (value) => ({
    reason: "wrong-shape",
    value,
})) satisfies Described<"gradient">;
