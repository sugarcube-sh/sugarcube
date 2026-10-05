import type { JsonPath, ParseResult, UnresolvedValue } from "../index.js";
import { readAlias, readPointer } from "./references.js";
import { refused } from "./value-errors.js";

export function readNumber(raw: unknown, at: JsonPath): ParseResult<UnresolvedValue<"number">> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference, ignored: [] };

    if (typeof raw === "number" && Number.isFinite(raw))
        return { ok: true, value: raw, ignored: [] };
    return refused(at, { type: "number", reason: "not-a-number", value: raw });
}
