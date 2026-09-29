import type { Alias, JsonPath, ParseResult, Pointer, ValueError } from "../index.js";
import { readAlias, readPointer } from "./references.js";

export function readList<I>(
    items: unknown[],
    at: JsonPath,
    readItem: (raw: unknown, at: JsonPath) => ParseResult<I | Alias | Pointer>,
): ParseResult<(I | Alias | Pointer)[]> {
    const errors: ValueError[] = [];
    const values = items.map((item, index) => {
        const reference = readAlias(item) ?? readPointer(item);
        if (reference) return reference;

        const result = readItem(item, [...at, index]);
        if (result.ok) return result.value;
        errors.push(...result.errors);
        return undefined;
    });

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, value: values as (I | Alias | Pointer)[] };
}
