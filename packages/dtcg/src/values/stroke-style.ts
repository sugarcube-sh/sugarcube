import type { StrokeStyleValue } from "../index.js";
import { type LineCap, lineCaps, strokeStyleKeywords } from "./keywords.js";
import {
    type Described,
    accepted,
    forms,
    list,
    literal,
    object,
    refusedAs,
    token,
} from "./shape.js";

type Keyword = Extract<StrokeStyleValue, { kind: "keyword" }>;

const keyword = literal<Keyword>((raw) => {
    const known = strokeStyleKeywords.find((each) => each === raw);
    if (known !== undefined) return accepted({ kind: "keyword", keyword: known });
    return typeof raw === "string"
        ? refusedAs({
              reason: "unknown-stroke-style-keyword",
              value: raw,
              keywords: strokeStyleKeywords,
          })
        : refusedAs({ reason: "wrong-shape", value: raw });
});

const lineCap = literal<LineCap>((raw) => {
    const known = lineCaps.find((each) => each === raw);
    return known === undefined
        ? refusedAs({ reason: "unknown-line-cap", value: raw, lineCaps })
        : accepted(known);
});

const dashArray = forms({ array: list(token("dimension"), "empty-dash-array") }, (value) => ({
    reason: "dash-array-not-a-list",
    value,
}));

export const strokeStyle = forms(
    {
        string: keyword,
        object: object({ dashArray: { shape: dashArray }, lineCap: { shape: lineCap } }, "dash"),
    },
    (value) => ({ reason: "wrong-shape", value }),
) satisfies Described<"strokeStyle">;
