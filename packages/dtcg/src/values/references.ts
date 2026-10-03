import type { Alias, Pointer } from "../index.js";
import { isJsonObject } from "./json.js";

/**
 * A reference to a whole token: a token path between curly braces, such as `"{color.brand}"`.
 * Names cannot contain `{`, `}` or `.` (Format 5.1.1), so the path is anything but a brace, and is
 * split on `.` afterwards. Spaces and `$root` are allowed, as they are in names.
 */
const ALIAS = /^\{([^{}]+)\}$/;

export function readAlias(raw: unknown): Alias | undefined {
    if (typeof raw !== "string") return undefined;

    const path = ALIAS.exec(raw)?.[1];
    if (path === undefined || path.split(".").some((segment) => segment === "")) return undefined;
    return { alias: path };
}

export function readPointer(raw: unknown): Pointer | undefined {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;

    const keys = Object.keys(raw);
    const ref = (raw as { $ref?: unknown }).$ref;
    if (keys.length !== 1 || typeof ref !== "string") return undefined;
    return { pointer: ref };
}

/**
 * Which reference a value is, as written in a file: `"{color.brand}"` is read as an
 * {@link Alias}, and `{ "$ref": "#/color/brand" }` as a {@link Pointer}. Anything else is not a
 * reference, and gives `undefined`.
 *
 * @example
 * readReference("{color.brand}") // { alias: "color.brand" }
 */
export function readReference(raw: unknown): Alias | Pointer | undefined {
    return readAlias(raw) ?? readPointer(raw);
}

/**
 * Whether a value from the model is a reference to a whole token: an {@link Alias}, as a parser
 * reads `"{color.brand}"`. Not for JSON as written in a file.
 *
 * @example
 * if (isAlias(token.value)) token.value.alias
 */
export function isAlias(value: unknown): value is Alias {
    return (
        isJsonObject(value) && Object.keys(value).length === 1 && typeof value.alias === "string"
    );
}

/**
 * Whether a value from the model is a JSON Pointer reference: a {@link Pointer}, as a parser reads
 * `{ "$ref": "#/…" }`. Not for JSON as written in a file.
 */
export function isPointer(value: unknown): value is Pointer {
    return (
        isJsonObject(value) && Object.keys(value).length === 1 && typeof value.pointer === "string"
    );
}
