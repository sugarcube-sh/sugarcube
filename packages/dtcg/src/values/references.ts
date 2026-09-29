import type { Alias, Pointer } from "../index.js";

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

export function isPlainObject(raw: unknown): raw is Record<string, unknown> {
    return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}
