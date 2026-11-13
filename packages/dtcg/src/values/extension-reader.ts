import { exceptionMessages } from "../error-messages.js";
import type { ExtensionError, ExtensionMessages, ExtensionResult } from "../model/extension.js";
import type { IgnoredProperty, ParseOptions, ValueError } from "../model/parse.js";
import type { JsonPath } from "../model/location.js";
import type { TokenType, ValueByType } from "../model/value.js";
import { parseValue } from "./parse-value.js";

/**
 * Reads the values in your extension, and collects any problems.
 *
 * Use it in a {@link Generator} or an {@link ExtensionValidator}. Make one with
 * {@link createExtensionReader}.
 */
export interface ExtensionReader<M extends ExtensionMessages> {
    /**
     * Reads one value of a type.
     *
     * If it doesn't fit the type, or is a reference, it returns `undefined`. The problem goes in
     * the result.
     *
     * @param type - The token type to read it as, such as `"dimension"`.
     * @param raw - The value, as your extension writes it.
     * @param jsonPath - Where it is inside your extension, such as `["min"]`.
     */
    read<T extends TokenType>(
        type: T,
        raw: unknown,
        jsonPath: JsonPath,
    ): ValueByType[T] | undefined;
    /**
     * Records one problem with your extension.
     *
     * It returns `undefined`, so a function reading one part can return it as that part's
     * missing value.
     *
     * @param jsonPath - Where the problem is, inside your extension, such as `["min"]`.
     * @param reason - Which of your messages describes it, such as `"not-an-object"`.
     * @param data - The facts that message needs, if any, such as `{ name: "min" }`.
     */
    report<R extends keyof M & string>(
        jsonPath: JsonPath,
        reason: R,
        ...data: Parameters<M[R]>
    ): undefined;
    /**
     * Gives the answer to return from `generate` or `validate`.
     *
     * That's the value, or every problem reported.
     *
     * @param value - The value you read, or `undefined` if a problem left none.
     * @throws {TypeError} If `value` is `undefined` and nothing was reported.
     */
    result<V>(value: V | undefined): ExtensionResult<V, M>;
}

/**
 * Makes an {@link ExtensionReader}.
 *
 * TypeScript checks that each `report` names one of your messages, with the facts it needs.
 *
 * @param options - How values are read, such as `ignoreUnknownProperties`.
 *
 * @example
 * // Read a fluid range, written { "min": …, "max": … }
 * const reader = createExtensionReader<typeof messages>(options);
 * if (!isJsonObject(range)) {
 *   reader.report([], "not-an-object");
 *   return reader.result(undefined);
 * }
 * const min = reader.read("dimension", range.min, ["min"]);
 * const max = reader.read("dimension", range.max, ["max"]);
 * return reader.result(min && max && { min, max });
 */
export function createExtensionReader<M extends ExtensionMessages>(
    options: ParseOptions = {},
): ExtensionReader<M> {
    const errors: (ExtensionError<M> | ValueError)[] = [];
    const ignored: IgnoredProperty[] = [];
    return {
        read: (type, raw, jsonPath) => {
            const read = parseValue(type, raw, { jsonPath, ...options, references: false });
            ignored.push(...read.ignored);
            if (read.ok) return read.value;
            errors.push(...read.errors);
            return undefined;
        },
        report: (jsonPath, reason, ...data) => {
            const error = { jsonPath, reason, ...(data.length > 0 && { data: data[0] }) };
            errors.push(error as ExtensionError<M>);
            return undefined;
        },
        result: (value) => {
            const ignoredField = ignored.length > 0 ? { ignored } : {};
            if (errors.length > 0) return { ok: false, errors, ...ignoredField };
            if (value === undefined) throw new TypeError(exceptionMessages.emptyResult);
            return { ok: true, value, ...ignoredField };
        },
    };
}
