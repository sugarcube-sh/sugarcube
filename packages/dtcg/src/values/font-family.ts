import type { JsonPath, ParseResult, Pointer, ValueError, UnresolvedValue } from "../index.js";
import { readAlias, readPointer } from "./references.js";
import { valueError } from "./value-errors.js";

const type = "fontFamily";

export function readFontFamily(
    raw: unknown,
    at: JsonPath,
): ParseResult<UnresolvedValue<"fontFamily">> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference };

    if (typeof raw === "string") {
        if (raw.trim() === "") {
            return {
                ok: false,
                errors: [valueError(at, { type, reason: "not-a-font-name", value: raw })],
            };
        }
        return { ok: true, value: [raw] };
    }

    if (!Array.isArray(raw)) {
        return { ok: false, errors: [valueError(at, { type, reason: "wrong-shape", value: raw })] };
    }

    if (raw.length === 0) {
        return { ok: false, errors: [valueError(at, { type, reason: "empty-font-list" })] };
    }

    const errors: ValueError[] = [];
    const names = raw.map((name: unknown, index): string | Pointer => {
        const pointer = readPointer(name);
        if (pointer) return pointer;
        if (readAlias(name)) {
            errors.push(
                valueError([...at, index], {
                    type,
                    reason: "alias-not-allowed-here",
                    reference: name as string,
                }),
            );
            return name as string;
        }

        if (typeof name !== "string" || name.trim() === "") {
            errors.push(
                valueError([...at, index], { type, reason: "not-a-font-name", value: name }),
            );
        }
        return name as string;
    });

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, value: names };
}
