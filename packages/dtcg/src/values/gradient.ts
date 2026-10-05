import { elements, object, ofType, oneOf, refuse } from "./syntax.js";

export const stop = object({
    color: ofType("color"),
    position: ofType("number", (position) => Math.min(1, Math.max(0, position))),
});

export const gradient = oneOf({
    array: elements(stop, { empty: "no-gradient-stops", parts: "stops" }),
    other: refuse("wrong-shape"),
});
