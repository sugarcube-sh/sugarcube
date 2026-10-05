import type { JsonPath, ParseResult, UnresolvedValue } from "../index.js";
import { type FontWeightKeyword, fontWeightKeywords } from "./keywords.js";
import { readAlias, readPointer } from "./references.js";
import { valueError } from "./value-errors.js";

const type = "fontWeight";

export function readFontWeight(
    raw: unknown,
    at: JsonPath,
): ParseResult<UnresolvedValue<"fontWeight">> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference, ignored: [] };

    if (typeof raw === "number" && Number.isFinite(raw)) {
        if (raw < 1 || raw > 1000) {
            return {
                ok: false,
                errors: [valueError(at, { type, reason: "font-weight-out-of-range", value: raw })],
                ignored: [],
            };
        }
        return { ok: true, value: raw, ignored: [] };
    }

    if (typeof raw === "string") {
        if (Object.hasOwn(fontWeightKeywords, raw)) {
            return { ok: true, value: fontWeightKeywords[raw as FontWeightKeyword], ignored: [] };
        }
        return {
            ok: false,
            errors: [valueError(at, { type, reason: "unknown-font-weight-keyword", value: raw })],
            ignored: [],
        };
    }

    return {
        ok: false,
        errors: [valueError(at, { type, reason: "wrong-shape", value: raw })],
        ignored: [],
    };
}
