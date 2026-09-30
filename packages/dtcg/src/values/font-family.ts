import type { JsonPath, ParseResult, Pointer, ValueError, UnresolvedValue } from "../index.js";
import { readAlias, readPointer } from "./references.js";
import { valueError } from "./value-errors.js";

export function readFontFamily(
    raw: unknown,
    at: JsonPath,
): ParseResult<UnresolvedValue<"fontFamily">> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference };

    if (typeof raw === "string") {
        if (raw.trim() === "") {
            return { ok: false, errors: [valueError(at, "not-a-font-name", raw)] };
        }
        return { ok: true, value: [raw] };
    }

    if (!Array.isArray(raw)) {
        return { ok: false, errors: [valueError(at, "wrong-shape", "fontFamily")] };
    }

    if (raw.length === 0) {
        return { ok: false, errors: [valueError(at, "empty-font-list")] };
    }

    const errors: ValueError[] = [];
    const names = raw.map((name: unknown, index): string | Pointer => {
        const pointer = readPointer(name);
        if (pointer) return pointer;
        if (readAlias(name)) {
            errors.push(valueError([...at, index], "alias-not-allowed-here", name as string));
            return name as string;
        }

        if (typeof name !== "string" || name.trim() === "") {
            errors.push(valueError([...at, index], "not-a-font-name", name));
        }
        return name as string;
    });

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, value: names };
}
