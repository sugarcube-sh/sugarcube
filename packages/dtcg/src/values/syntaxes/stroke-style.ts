import { lineCaps, strokeStyleKeywords } from "../keywords.js";
import { list, literal, err, object, ofType, ok, oneOf, reject, wrongShape } from "../syntax.js";

const keyword = literal((raw) => {
    const known = strokeStyleKeywords.find((each) => each === raw);
    if (known !== undefined) return ok(known);
    return typeof raw === "string"
        ? err({
              reason: "unknown-stroke-style-keyword",
              value: raw,
              keywords: strokeStyleKeywords,
          })
        : err(wrongShape(raw));
});

const lineCap = literal((raw) => {
    const known = lineCaps.find((each) => each === raw);
    return known === undefined
        ? err({ reason: "unknown-line-cap", value: raw, lineCaps })
        : ok(known);
});

const dashArray = oneOf({
    array: list(ofType("dimension"), "empty-dash-array"),
    other: reject("dash-array-not-a-list"),
});

export const strokeStyle = oneOf({
    string: keyword,
    object: object({ dashArray, lineCap }),
    other: wrongShape,
});
