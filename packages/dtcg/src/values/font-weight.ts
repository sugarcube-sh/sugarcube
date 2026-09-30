import type { JsonPath, ParseResult, UnresolvedValue } from "../index.js";
import { type FontWeightKeyword, fontWeightKeywords } from "./keywords.js";
import { readAlias, readPointer } from "./references.js";
import { valueError } from "./value-errors.js";

export function readFontWeight(
    raw: unknown,
    at: JsonPath,
): ParseResult<UnresolvedValue<"fontWeight">> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference };

    if (typeof raw === "number" && Number.isFinite(raw)) {
        if (raw < 1 || raw > 1000) {
            return { ok: false, errors: [valueError(at, "font-weight-out-of-range", raw)] };
        }
        return { ok: true, value: raw };
    }

    if (typeof raw === "string") {
        if (Object.hasOwn(fontWeightKeywords, raw)) {
            return { ok: true, value: fontWeightKeywords[raw as FontWeightKeyword] };
        }
        return { ok: false, errors: [valueError(at, "unknown-font-weight-keyword", raw)] };
    }

    return { ok: false, errors: [valueError(at, "wrong-shape", "fontWeight")] };
}
