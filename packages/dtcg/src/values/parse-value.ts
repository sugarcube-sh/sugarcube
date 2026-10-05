import type {
    JsonPath,
    ParseOptions,
    ParseResult,
    TokenType,
    UnresolvedValue,
    ValueByType,
} from "../index.js";
import { type Notes, readToken } from "./read-syntax.js";
import { isAlias } from "./references.js";
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
    if (references) return readToken(type, raw, at, options);

    const notes: Notes = { references: [], readAgain: [] };
    const read = readToken(type, raw, at, options, notes);
    if (!read.ok || notes.references.length === 0) return read;
    const errors = notes.references.map(({ ref, at: written }) =>
        valueError(written, {
            type,
            reason: "reference-not-allowed",
            reference: isAlias(ref) ? `{${ref.alias}}` : ref.pointer,
        }),
    );
    return { ok: false, errors, ignored: read.ignored };
}
