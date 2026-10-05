import { type Described, accepted, forms, list, literal, refusedAs } from "./shape.js";

function isFontName(raw: unknown): raw is string {
    return typeof raw === "string" && raw.trim() !== "";
}

const name = literal((raw) =>
    isFontName(raw) ? accepted(raw) : refusedAs({ reason: "not-a-font-name", value: raw }),
);

const lone = literal((raw) =>
    isFontName(raw) ? accepted([raw]) : refusedAs({ reason: "not-a-font-name", value: raw }),
);

export const fontFamily = forms(
    { string: lone, array: list(name, "empty-font-list") },
    (value) => ({ reason: "wrong-shape", value }),
) satisfies Described<"fontFamily">;
