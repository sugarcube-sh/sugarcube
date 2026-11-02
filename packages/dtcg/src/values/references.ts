import type {
    CurlyBraceReference,
    JsonPointerReference,
    Move,
    WrittenReference,
} from "../model.js";
import { tokenPath } from "../path.js";
import { encodePointer, refSteps } from "../read/pointer.js";
import { pointerParts } from "../read/ref-meaning.js";
import { isJsonObject } from "./json.js";

/**
 * A reference to a whole token: a token path between curly braces, such as `"{color.brand}"`.
 * Names cannot contain `{`, `}` or `.` (Format 5.1.1), so the path is anything but a brace, and is
 * split on `.` afterwards. Spaces and `$root` are allowed, as they are in names.
 */
const CURLY_BRACE = /^\{([^{}]+)\}$/;

export function readCurlyBrace(raw: unknown): CurlyBraceReference | undefined {
    if (typeof raw !== "string") return undefined;

    const path = CURLY_BRACE.exec(raw)?.[1];
    if (path === undefined || path.split(".").some((segment) => segment === "")) return undefined;
    return { syntax: "curly-brace", path };
}

export function readJsonPointer(raw: unknown): JsonPointerReference | undefined {
    if (!isJsonObject(raw)) return undefined;

    const keys = Object.keys(raw);
    const ref = raw.$ref;
    if (keys.length !== 1 || typeof ref !== "string") return undefined;
    return { syntax: "json-pointer", pointer: ref };
}

/**
 * Which reference a value is, as written in a file: `"{color.brand}"` in curly brace syntax
 * (Format 7.1.1), `{ "$ref": "#/color/brand" }` in JSON Pointer syntax (Format 7.1.2). Anything
 * else is not a reference, and gives `undefined`.
 *
 * @example
 * parseReference("{color.brand}") // { syntax: "curly-brace", path: "color.brand" }
 */
export function parseReference(raw: unknown): WrittenReference | undefined {
    return readCurlyBrace(raw) ?? readJsonPointer(raw);
}

/**
 * Whether a value from the model is a reference, in either syntax, as a parser reads it: a
 * {@link WrittenReference}, or a token's {@link Reference}. Not for JSON as written in a file.
 *
 * @example
 * if (isReference(token.value)) token.value.syntax
 */
export function isReference(value: unknown): value is WrittenReference {
    if (!isJsonObject(value)) return false;
    if (value.syntax === "curly-brace") return typeof value.path === "string";
    return value.syntax === "json-pointer" && typeof value.pointer === "string";
}

/**
 * A reference's text, as a problem's `ref` gives it: a curly brace reference's path, without the
 * braces, or a JSON Pointer as written.
 *
 * @example
 * toReferenceTarget(parseReference("{color.ink}"))                // "color.ink"
 * toReferenceTarget(parseReference({ $ref: "#/color/ink/$value" })) // "#/color/ink/$value"
 */
export function toReferenceTarget(reference: WrittenReference): string {
    return reference.syntax === "curly-brace" ? reference.path : reference.pointer;
}

/**
 * The token path a reference names: a curly brace's path, or for a pointer its steps before
 * `$value`, or all of them when it has none (Format Example 21). `undefined` for a pointer naming
 * none, such as `#/` or one into another file.
 */
export function namedPath(ref: WrittenReference): string | undefined {
    if (ref.syntax === "curly-brace") return ref.path;
    const steps = refSteps(ref.pointer);
    return steps && pointerParts(steps).path;
}

/**
 * A reference written as a JSON Pointer (Format 7.1.2), as it goes in a file: `"{color.ink}"` is
 * `{ "$ref": "#/color/ink/$value" }`, which the spec calls equivalent. A pointer is given as it
 * is written.
 *
 * @example
 * toJsonPointer(parseReference("{color.ink}")) // { $ref: "#/color/ink/$value" }
 */
export function toJsonPointer(reference: WrittenReference): { $ref: string } {
    if (reference.syntax === "json-pointer") return { $ref: reference.pointer };
    return { $ref: encodePointer([...reference.path.split("."), "$value"]) };
}

export function movedReference<R extends WrittenReference>(ref: R, moved: readonly Move[]): R;
export function movedReference(ref: WrittenReference, moved: readonly Move[]): WrittenReference {
    if (ref.syntax === "curly-brace") {
        return { syntax: "curly-brace", path: tokenPath.applyMoves(ref.path, moved) };
    }
    const steps = refSteps(ref.pointer);
    if (!steps) return ref;
    const { path, inside } = pointerParts(steps);
    if (path === undefined) return ref;
    const now = tokenPath.applyMoves(path, moved);
    if (now === path) return ref;
    const pointer = encodePointer([...now.split("."), ...(inside ? ["$value", ...inside] : [])]);
    return { syntax: "json-pointer", pointer };
}
