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
 * A curly brace reference, such as `"{color.primary}"`.
 *
 * Anything but a brace counts as the path, since names can't contain braces.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#character-restrictions | Format 5.1.1, Character restrictions}
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
 * Finds which reference a value is, as written in a file.
 *
 * It reads both syntaxes. For anything else, it returns `undefined`.
 *
 * @param raw - A value as written in a file, such as a token's `$value`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#curly-brace-syntax-token-references | Format 7.1.1, Curly brace syntax} and
 * {@link https://www.designtokens.org/TR/2025.10/format/#json-pointer-syntax-required-support | 7.1.2, JSON Pointer syntax}
 *
 * @example
 * // A curly brace reference
 * parseReference("{color.primary}")
 * // => { syntax: "curly-brace", path: "color.primary" }
 */
export function parseReference(raw: unknown): WrittenReference | undefined {
    return readCurlyBrace(raw) ?? readJsonPointer(raw);
}

/**
 * Checks whether a value dtcg has read is a reference.
 *
 * For an entry in a token's `references`, check its `asWritten`. For JSON as written in a file,
 * use {@link parseReference}.
 *
 * @param value - A value dtcg has read, such as `token.value`.
 *
 * @example
 * // button.background is written "{color.primary}"
 * isReference(light.getToken("button.background")?.value)
 * // => true
 */
export function isReference(value: unknown): value is WrittenReference {
    if (!isJsonObject(value)) return false;
    if (value.syntax === "curly-brace") return typeof value.path === "string";
    return value.syntax === "json-pointer" && typeof value.pointer === "string";
}

/**
 * Gives the text a problem shows for a reference.
 *
 * For a curly brace reference, that's its path.
 * For a JSON Pointer, it's the pointer as written.
 *
 * @param reference - A reference, such as one from {@link parseReference}.
 *
 * @example
 * // A curly brace reference
 * toReferenceTarget(parseReference("{color.primary}")!)
 * // => "color.primary"
 */
export function toReferenceTarget(reference: WrittenReference): string {
    return reference.syntax === "curly-brace" ? reference.path : reference.pointer;
}

/**
 * Finds the token path a reference names.
 *
 * It's `undefined` for a JSON Pointer that names no token, such as `#/`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#json-pointer-syntax-required-support | Format 7.1.2, JSON Pointer syntax}
 */
export function namedPath(ref: WrittenReference): string | undefined {
    if (ref.syntax === "curly-brace") return ref.path;
    const steps = refSteps(ref.pointer);
    return steps && pointerParts(steps).path;
}

/**
 * Writes a reference as a JSON Pointer, for a file.
 *
 * A JSON Pointer comes back as it is.
 *
 * @param reference - A reference, such as one from {@link parseReference}.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#json-pointer-syntax-required-support | Format 7.1.2, JSON Pointer syntax}
 *
 * @example
 * // A curly brace reference
 * toJsonPointer(parseReference("{color.primary}")!)
 * // => { $ref: "#/color/primary/$value" }
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
