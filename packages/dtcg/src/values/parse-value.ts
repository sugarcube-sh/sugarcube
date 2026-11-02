import type {
    JsonPath,
    ParseOptions,
    ParseResult,
    TokenType,
    UnresolvedValue,
    ValueByType,
} from "../model.js";
import { type Notes, readToken } from "./read-syntax.js";
import { valueError } from "./value-errors.js";

/**
 * Reads one value of a type into its shape, or explains why it cannot. `jsonPath` is where the
 * value sits, and each problem's `jsonPath` starts with it. A reference to a whole token, written
 * `"{color.brand}"`, is read as a `CurlyBraceReference`; a JSON Pointer is read as a
 * `JsonPointerReference`, and may stand in place of the whole value or any part of it.
 *
 * @example
 * parseValue("color", { colorSpace: "srgb", components: [1, 0, 1] }, [])
 * // { ok: true, value: { colorSpace: "srgb", components: [1, 0, 1], alpha: 1 }, ignored: [] }
 *
 * @example
 * parseValue("color", "{color.brand}", [])
 * // { ok: true, value: { syntax: "curly-brace", path: "color.brand" }, ignored: [] }
 *
 * @example
 * parseValue("color", { colorSpace: "srgb", components: [1, 0, 1], name: "magenta" }, [], {
 *   ignoreUnknownProperties: true,
 * })
 * // read without `name`, which is in `ignored`:
 * // [{ kind: "unknown-property", jsonPath: ["name"],
 * //    detail: { type: "color", property: "name" }, … }]
 */
export function parseValue<T extends TokenType>(
    type: T,
    raw: unknown,
    jsonPath: JsonPath,
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
    jsonPath: JsonPath,
    options: ParseOptions & { references: false },
): ParseResult<ValueByType[T]>;
export function parseValue<T extends TokenType>(
    type: T,
    raw: unknown,
    jsonPath: JsonPath,
    { references = true, ...options }: ParseOptions & { references?: boolean } = {},
): ParseResult<UnresolvedValue<T> | ValueByType[T]> {
    if (references) return readToken(type, raw, jsonPath, options);

    const notes: Notes = { references: [], readAgain: [] };
    const read = readToken(type, raw, jsonPath, options, notes);
    if (!read.ok || notes.references.length === 0) return read;
    const errors = notes.references.map(({ ref, jsonPath: written }) =>
        valueError(written, {
            type,
            reason: "reference-not-allowed",
            reference: ref.syntax === "curly-brace" ? `{${ref.path}}` : ref.pointer,
        }),
    );
    return { ok: false, errors, ignored: read.ignored };
}
