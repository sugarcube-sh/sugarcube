import { thrownMessages } from "../error-messages.js";
import type {
    ExtensionError,
    ExtensionMessages,
    JsonPath,
    TokenType,
    ValueByType,
    ValueError,
} from "../index.js";
import { parseValue } from "./parse-value.js";

/**
 * Reads an extension's values and collects why it is not valid, for a {@link Generator} or an
 * {@link ExtensionValidator}. Made by {@link extensionReader}.
 */
export interface ExtensionReader<M extends ExtensionMessages> {
    /**
     * Reads one literal value of a type. A value that does not fit, or a reference, which `read`
     * never resolves inside an extension, gives `undefined` and keeps the parser's error.
     */
    read<T extends TokenType>(type: T, raw: unknown, at: JsonPath): ValueByType[T] | undefined;
    /**
     * Records one reason the extension is not valid, with the facts its message takes, if any.
     * `at` starts at the extension. Gives `undefined`, so a function reading one part can return
     * it as that part's missing value.
     */
    report<R extends keyof M & string>(
        at: JsonPath,
        reason: R,
        ...data: Parameters<M[R]>
    ): undefined;
    /**
     * The answer to return from `generate` or `validate`: the value when nothing was reported,
     * otherwise every problem, in the order found. Give `undefined` when a problem left no value.
     */
    result<V>(
        value: V | undefined,
    ): { ok: true; value: V } | { ok: false; errors: (ExtensionError<M> | ValueError)[] };
}

/**
 * Makes an {@link ExtensionReader}, whose reasons and facts are checked against the type of the
 * messages table given to {@link defineGenerator} or {@link defineExtensionValidator}. Every
 * problem is collected, not only the first.
 *
 * @example
 * const reader = extensionReader<typeof messages>();
 * if (!isJsonObject(range)) {
 *   reader.report([], "not-an-object");
 *   return reader.result(undefined);
 * }
 * const min = reader.read("dimension", range.min, ["min"]);
 * const max = reader.read("dimension", range.max, ["max"]);
 * return reader.result(min && max && { min, max });
 *
 * @throws {TypeError} When `result` is given no value and nothing was reported.
 */
export function extensionReader<M extends ExtensionMessages>(): ExtensionReader<M> {
    const errors: (ExtensionError<M> | ValueError)[] = [];
    return {
        read: (type, raw, at) => {
            const read = parseValue(type, raw, at, { references: false });
            if (read.ok) return read.value;
            errors.push(...read.errors);
            return undefined;
        },
        report: (at, reason, ...data) => {
            const error = { path: at, reason, ...(data.length > 0 && { data: data[0] }) };
            errors.push(error as ExtensionError<M>);
            return undefined;
        },
        result: (value) => {
            if (errors.length > 0) return { ok: false, errors };
            if (value === undefined) throw new TypeError(thrownMessages.emptyResult);
            return { ok: true, value };
        },
    };
}
