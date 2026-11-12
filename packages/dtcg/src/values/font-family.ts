import { list, literal, err, ok, oneOf, single, wrongShape } from "./syntax.js";

const name = literal((raw) =>
    typeof raw === "string" && raw.trim() !== ""
        ? ok(raw)
        : err({ reason: "not-a-font-name", value: raw }),
);

export const fontFamily = oneOf({
    string: single(name),
    array: list(name, "empty-font-list"),
    other: wrongShape,
});
