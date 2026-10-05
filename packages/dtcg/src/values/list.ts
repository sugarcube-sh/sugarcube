import type {
    Alias,
    IgnoredProperty,
    JsonPath,
    ParseOptions,
    ParseResult,
    Pointer,
    ValueError,
} from "../index.js";
import { readAlias, readPointer } from "./references.js";
import { withIgnored } from "./set-aside.js";

export function readList<I>(
    items: unknown[],
    at: JsonPath,
    readItem: (
        raw: unknown,
        at: JsonPath,
        options?: ParseOptions,
    ) => ParseResult<I | Alias | Pointer>,
    options?: ParseOptions,
): ParseResult<(I | Alias | Pointer)[]> {
    const errors: ValueError[] = [];
    const ignored: IgnoredProperty[] = [];
    const values = items.map((item, index) => {
        const reference = readAlias(item) ?? readPointer(item);
        if (reference) return reference;

        const result = readItem(item, [...at, index], options);
        if (result.ignored) ignored.push(...result.ignored);
        if (result.ok) return result.value;
        errors.push(...result.errors);
        return undefined;
    });

    if (errors.length > 0) return withIgnored({ ok: false, errors }, ignored);
    return withIgnored({ ok: true, value: values as (I | Alias | Pointer)[] }, ignored);
}
