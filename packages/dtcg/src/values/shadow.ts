import {
    type Described,
    asList,
    elements,
    forms,
    literal,
    no,
    object,
    ok,
    token,
    withDefault,
} from "./shape.js";

const inset = literal(
    (raw) => (typeof raw === "boolean" ? ok(raw) : no({ reason: "not-a-boolean", value: raw })),
    "boolean",
);

export const layer = object({
    color: token("color"),
    offsetX: token("dimension"),
    offsetY: token("dimension"),
    blur: token("dimension"),
    spread: token("dimension"),
    inset: withDefault(inset, false),
});

export const shadow = forms({
    array: elements(layer, "no-shadows"),
    other: asList(layer),
}) satisfies Described<"shadow">;
