import type { ValueErrorDetail } from "../values/value-errors.js";
import type { JsonPath } from "./location.js";
import type { TokenType } from "./value.js";

/** Why one value couldn't be read. */
export interface ValueError {
    kind: "invalid-value";
    /**
     * Where the problem is, such as `["unit"]`.
     *
     * It starts with the `jsonPath` the value was read at.
     */
    jsonPath: JsonPath;
    message: string;
    /** How to fix it, when there's a clear way, such as `` "use `px` or `rem`" ``. */
    help?: string;
    /** Why, with the facts behind the message. */
    detail: ValueErrorDetail;
}

/**
 * A property a value's type doesn't have, set aside, such as `paragraphSpacing`.
 *
 * The rest of the value is read without it.
 */
export interface IgnoredProperty {
    kind: "unknown-property";
    /** Where the property is, such as `["$value", "paragraphSpacing"]`. */
    jsonPath: JsonPath;
    message: string;
    /** The type of the value it's in. For part of a composite, that's the part's type. */
    detail: { type: TokenType; property: string };
}

/**
 * The result of reading one value.
 *
 * `ignored` lists the properties set aside, whether or not the value could be read.
 */
export type ParseResult<V> =
    | { ok: true; value: V; ignored: IgnoredProperty[] }
    | { ok: false; errors: ValueError[]; ignored: IgnoredProperty[] };

/** How values are read. */
export interface ParseOptions {
    /**
     * Reads a hex string, such as `"#e11d48"`, as an sRGB color.
     *
     * The string is kept as `hex`, and CSS writes it as that string. DTCG 2025.10 doesn't allow it.
     * Off, a hex string is a `hex-string-color` error.
     *
     * @default false
     */
    hexStringColors?: boolean;
    /**
     * Sets aside a property a value's type doesn't have, such as `paragraphSpacing`.
     *
     * The rest of the value is read, and `read` reports a warning. Off, it's an `invalid-value`
     * error. A `$ref` with other properties is an error either way.
     *
     * @default false
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#groups-versus-composite-tokens | Format 9.2, Groups versus composite tokens}
     */
    ignoreUnknownProperties?: boolean;
}
