import { type Described, forms, list, literal, no, ok, refuse } from "./shape.js";

function isFontName(raw: unknown): raw is string {
    return typeof raw === "string" && raw.trim() !== "";
}

const name = literal((raw) =>
    isFontName(raw) ? ok(raw) : no({ reason: "not-a-font-name", value: raw }),
);

const lone = literal((raw) =>
    isFontName(raw) ? ok([raw]) : no({ reason: "not-a-font-name", value: raw }),
);

export const fontFamily = forms({
    string: lone,
    array: list(name, "empty-font-list"),
    other: refuse("wrong-shape"),
}) satisfies Described<"fontFamily">;
