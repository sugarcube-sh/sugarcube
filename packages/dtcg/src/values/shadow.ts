import {
    type Described,
    accepted,
    asList,
    elements,
    forms,
    literal,
    object,
    refusedAs,
    token,
} from "./shape.js";

const inset = literal(
    (raw) =>
        typeof raw === "boolean"
            ? accepted(raw)
            : refusedAs({ reason: "not-a-boolean", value: raw }),
    "boolean",
);

export const layer = object({
    color: { shape: token("color") },
    offsetX: { shape: token("dimension") },
    offsetY: { shape: token("dimension") },
    blur: { shape: token("dimension") },
    spread: { shape: token("dimension") },
    inset: { shape: inset, default: false },
});

export const shadow = forms(
    { array: elements(layer, "no-shadows") },
    asList(layer),
) satisfies Described<"shadow">;
