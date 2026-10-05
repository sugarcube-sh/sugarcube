import { type FontWeightKeyword, fontWeightKeywords } from "./keywords.js";
import { type Described, accepted, forms, literal, refusedAs } from "./shape.js";

const weight = literal((raw) => {
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return refusedAs({ reason: "wrong-shape", value: raw });
    }
    return raw < 1 || raw > 1000
        ? refusedAs({ reason: "font-weight-out-of-range", value: raw })
        : accepted(raw);
});

const keyword = literal<number>((raw) => {
    if (typeof raw !== "string") return refusedAs({ reason: "wrong-shape", value: raw });
    return isKeyword(raw)
        ? accepted(fontWeightKeywords[raw])
        : refusedAs({ reason: "unknown-font-weight-keyword", value: raw });
});

function isKeyword(raw: string): raw is FontWeightKeyword {
    return Object.hasOwn(fontWeightKeywords, raw);
}

export const fontWeight = forms({ number: weight, string: keyword }, (value) => ({
    reason: "wrong-shape",
    value,
})) satisfies Described<"fontWeight">;
