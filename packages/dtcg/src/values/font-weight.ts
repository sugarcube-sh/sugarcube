import { type FontWeightKeyword, fontWeightKeywords } from "./keywords.js";
import { literal, no, ok, oneOf, refuse } from "./syntax.js";

const weight = literal((raw) => {
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return no({ reason: "wrong-shape", value: raw });
    }
    return raw < 1 || raw > 1000 ? no({ reason: "font-weight-out-of-range", value: raw }) : ok(raw);
});

const keyword = literal((raw) => {
    if (typeof raw !== "string") return no({ reason: "wrong-shape", value: raw });
    return isKeyword(raw)
        ? ok(fontWeightKeywords[raw])
        : no({ reason: "unknown-font-weight-keyword", value: raw });
});

function isKeyword(raw: string): raw is FontWeightKeyword {
    return Object.hasOwn(fontWeightKeywords, raw);
}

export const fontWeight = oneOf({
    number: weight,
    string: keyword,
    other: refuse("wrong-shape"),
});
