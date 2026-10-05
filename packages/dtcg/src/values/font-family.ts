import { oneOf, list, literal, no, ok, refuse, single } from "./syntax.js";

const name = literal((raw) =>
    typeof raw === "string" && raw.trim() !== ""
        ? ok(raw)
        : no({ reason: "not-a-font-name", value: raw }),
);

export const fontFamily = oneOf({
    string: single(name),
    array: list(name, "empty-font-list"),
    other: refuse("wrong-shape"),
});
