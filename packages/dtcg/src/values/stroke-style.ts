import { lineCaps, strokeStyleKeywords } from "./keywords.js";
import { oneOf, list, literal, no, object, ok, refuse, ofType } from "./syntax.js";

const keyword = literal((raw) => {
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

const lineCap = literal((raw) => {
    const known = lineCaps.find((each) => each === raw);
    return known === undefined
        ? no({ reason: "unknown-line-cap", value: raw, lineCaps })
        : ok(known);
});

const dashArray = oneOf({
    array: list(ofType("dimension"), "empty-dash-array"),
    other: refuse("dash-array-not-a-list"),
});

export const strokeStyle = oneOf({
    string: keyword,
    object: object({ dashArray, lineCap }, "dash"),
    other: refuse("wrong-shape"),
});
