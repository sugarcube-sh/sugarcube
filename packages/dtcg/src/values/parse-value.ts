import type {
    JsonPath,
    ParseOptions,
    ParseResult,
    TokenType,
    UnresolvedValue,
    ValueByType,
} from "../index.js";
import { parsers } from "./parsers.js";
import { isJsonObject } from "./json.js";
import { isAlias, isPointer } from "./references.js";
import { valueError } from "./value-errors.js";

/**
 * Reads one value of a type given at run time, with that type's parser. A reference is read as
 * an `Alias` or `Pointer`, as the parsers read it.
 *
 * @example
 * parseValue(token.type, input, [])
 */
export function parseValue<T extends TokenType>(
    type: T,
    raw: unknown,
    at: JsonPath,
    options?: ParseOptions & { references?: true },
): ParseResult<UnresolvedValue<T>>;
/**
 * Reads one value of a type given at run time, accepting only a literal value: a reference, in
 * place of the whole value or any part of it, is an error with the reason
 * `"reference-not-allowed"`, at the place it is written.
 *
 * @example
 * const min = parseValue("dimension", recipe.min, ["min"], { references: false });
 * if (min.ok) min.value.unit // "px" | "rem": no reference to rule out
 */
export function parseValue<T extends TokenType>(
    type: T,
    raw: unknown,
    at: JsonPath,
    options: ParseOptions & { references: false },
): ParseResult<ValueByType[T]>;
export function parseValue<T extends TokenType>(
    type: T,
    raw: unknown,
    at: JsonPath,
    { references = true, ...options }: ParseOptions & { references?: boolean } = {},
): ParseResult<UnresolvedValue<T> | ValueByType[T]> {
    const read: ParseResult<unknown> = parsers[type](raw, at, options);
    if (!read.ok || references) return read as ParseResult<UnresolvedValue<T>>;

    const listed = Array.isArray(read.value) && !Array.isArray(raw);
    const errors = referencesIn(read.value, []).map(({ inside, written }) =>
        valueError([...at, ...(listed ? inside.slice(1) : inside)], {
            type,
            reason: "reference-not-allowed",
            reference: written,
        }),
    );
    if (errors.length === 0) return read as ParseResult<ValueByType[T]>;
    return { ok: false, errors, ignored: read.ignored };
}

function referencesIn(value: unknown, inside: JsonPath): { inside: JsonPath; written: string }[] {
    if (isAlias(value)) return [{ inside, written: `{${value.alias}}` }];
    if (isPointer(value)) return [{ inside, written: value.pointer }];
    if (Array.isArray(value)) return value.flatMap((each, i) => referencesIn(each, [...inside, i]));
    if (isJsonObject(value)) {
        return Object.entries(value).flatMap(([key, each]) => referencesIn(each, [...inside, key]));
    }
    return [];
}
