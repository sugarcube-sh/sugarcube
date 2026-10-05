import type { StrokeStyleValue } from "../index.js";
import { type LineCap, lineCaps, strokeStyleKeywords } from "./keywords.js";
import { type Described, forms, list, literal, no, object, ok, refuse, token } from "./shape.js";

type Keyword = Extract<StrokeStyleValue, { kind: "keyword" }>;

const keyword = literal<Keyword>((raw) => {
    const known = strokeStyleKeywords.find((each) => each === raw);
    if (known !== undefined) return ok({ kind: "keyword", keyword: known });
    return typeof raw === "string"
        ? no({
              reason: "unknown-stroke-style-keyword",
              value: raw,
              keywords: strokeStyleKeywords,
          })
        : no({ reason: "wrong-shape", value: raw });
});

const lineCap = literal<LineCap>((raw) => {
    const known = lineCaps.find((each) => each === raw);
    return known === undefined
        ? no({ reason: "unknown-line-cap", value: raw, lineCaps })
        : ok(known);
});

const dashArray = forms({
    array: list(token("dimension"), "empty-dash-array"),
    other: refuse("dash-array-not-a-list"),
});

export const strokeStyle = forms({
    string: keyword,
    object: object({ dashArray, lineCap }, "dash"),
    other: refuse("wrong-shape"),
}) satisfies Described<"strokeStyle">;
