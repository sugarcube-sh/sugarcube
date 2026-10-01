import type { JsonPath, ParseResult, UnresolvedValue } from "../index.js";
import { readAlias, readPointer } from "./references.js";
import { valueError } from "./value-errors.js";

export function readNumber(raw: unknown, at: JsonPath): ParseResult<UnresolvedValue<"number">> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference };

    if (typeof raw === "number" && Number.isFinite(raw)) return { ok: true, value: raw };
    return {
        ok: false,
        errors: [valueError(at, { type: "number", reason: "not-a-number", value: raw })],
    };
}
