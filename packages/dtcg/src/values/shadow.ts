import { elements, oneOf, literal, no, object, ok, single, ofType, withDefault } from "./syntax.js";

const inset = literal(
    (raw) => (typeof raw === "boolean" ? ok(raw) : no({ reason: "not-a-boolean", value: raw })),
    "boolean",
);

export const layer = object({
    color: ofType("color"),
    offsetX: ofType("dimension"),
    offsetY: ofType("dimension"),
    blur: ofType("dimension"),
    spread: ofType("dimension"),
    inset: withDefault(inset, false),
});

export const shadow = oneOf({
    array: elements(layer, { empty: "no-shadows", parts: "layers" }),
    other: single(layer),
});
