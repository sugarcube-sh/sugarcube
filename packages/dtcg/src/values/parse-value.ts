import type {
    JsonPath,
    ParseOptions,
    ParseResult,
    TokenType,
    UnresolvedValue,
    ValueByType,
} from "../model/index.js";
import { exceptionMessages } from "../error-messages.js";
import { type ReadCollector, readToken } from "./read-syntax.js";
import { isTokenType } from "./token-types.js";
import { valueError } from "./value-errors.js";

/** How {@link parseValue} reads a value. */
export interface ParseValueOptions extends ParseOptions {
    /**
     * Where the value is in its file, such as `["$value"]`. Each problem's `jsonPath` starts with
     * it.
     *
     * @default []
     */
    readonly jsonPath?: JsonPath;
}

/**
 * Reads one value of a type.
 *
 * If it can't, the result says why. A reference is read as written, not followed.
 *
 * @param type - The token type, such as `"color"`.
 * @param raw - The value as written, such as a token's `$value`.
 * @param options - Where the value is in its file, and how to read it.
 * @throws {TypeError} If `type` isn't one of `tokenTypes`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#types | Format 8, Types}
 *
 * @example
 * // A color
 * parseValue("color", { colorSpace: "srgb", components: [1, 0, 1] })
 * // => { ok: true, value: { colorSpace: "srgb", components: [1, 0, 1], alpha: 1 }, ignored: [] }
 *
 * @example
 * // A reference is read, not followed
 * parseValue("color", "{color.primary}")
 * // => { ok: true, value: { syntax: "curly-brace", path: "color.primary" }, ignored: [] }
 */
export function parseValue<T extends TokenType>(
    type: T,
    raw: unknown,
    options?: ParseValueOptions & { references?: true },
): ParseResult<UnresolvedValue<T>>;
/**
 * Reads one value of a type, refusing references.
 *
 * When it succeeds, TypeScript knows the value has no references.
 *
 * @param type - The token type, such as `"dimension"`.
 * @param raw - The value as written, such as `{ "value": 16, "unit": "px" }`.
 * @param options - `references: false`, and where the value is in its file, if anywhere.
 * @throws {TypeError} If `type` isn't one of `tokenTypes`.
 *
 * @example
 * // A recipe's minimum size, written as a reference
 * parseValue("dimension", "{space.sm}", { jsonPath: ["min"], references: false })
 * // => {
 * //   ok: false,
 * //   errors: [
 * //     { kind: "invalid-value", jsonPath: ["min"], detail: { reason: "reference-not-allowed", … } },
 * //   ],
 * //   ignored: [],
 * // }
 */
export function parseValue<T extends TokenType>(
    type: T,
    raw: unknown,
    options: ParseValueOptions & { references: false },
): ParseResult<ValueByType[T]>;
export function parseValue<T extends TokenType>(
    type: T,
    raw: unknown,
    {
        jsonPath = [],
        references = true,
        ...options
    }: ParseValueOptions & { references?: boolean } = {},
): ParseResult<UnresolvedValue<T> | ValueByType[T]> {
    if (!isTokenType(type)) throw new TypeError(exceptionMessages.notATokenType(type));
    if (references) return readToken(type, raw, jsonPath, options);

    const notes: ReadCollector = { references: [], deferredReads: [] };
    const read = readToken(type, raw, jsonPath, options, notes);
    if (!read.ok || notes.references.length === 0) return read;
    const errors = notes.references.map(({ ref, jsonPath: referenceJsonPath }) =>
        valueError(referenceJsonPath, {
            type,
            reason: "reference-not-allowed",
            reference: ref.syntax === "curly-brace" ? `{${ref.path}}` : ref.pointer,
        }),
    );
    return { ok: false, errors, ignored: read.ignored };
}
