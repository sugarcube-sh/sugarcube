export function joinTokenPath(...segments: string[]): string {
    return segments
        .flatMap((s) => s.split("."))
        .filter(Boolean)
        .join(".");
}

export function wrapRef(path: string): string {
    return `{${path}}`;
}

export function unwrapRef(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return undefined;
    const inner = trimmed.slice(1, -1).trim();
    return inner.length > 0 ? inner : undefined;
}

// DTCG 2025.10 §6.2
export const ROOT_SEGMENT = "$root";

export function isRootPath(path: string): boolean {
    return path === ROOT_SEGMENT || path.endsWith(`.${ROOT_SEGMENT}`);
}

export function stripRoot(path: string): string {
    return isRootPath(path) ? path.slice(0, -(ROOT_SEGMENT.length + 1)) : path;
}

export function stripTrailingGlob(path: string): string {
    let p = path;
    while (p.endsWith(".*")) p = p.slice(0, -2);
    return p;
}

export function lastSegment(path: string): string {
    const p = stripTrailingGlob(path);
    const lastDot = p.lastIndexOf(".");
    return lastDot === -1 ? p : p.substring(lastDot + 1);
}

/** How a step reads in a list. A group's own value shows as the group. */
export function stepLabel(path: string): string {
    return lastSegment(isRootPath(path) ? stripRoot(path) : path);
}

export type PathSegmentRole = "ns" | "leaf" | "tail" | "num";

export type PathSegment = {
    text: string;
    role: PathSegmentRole;
    /** The path from the root down to this segment. */
    path: string;
};

export function tokenPathSegments(path: string): PathSegment[] {
    if (!path) return [];
    const parts = path.split(".");
    const last = parts.length - 1;
    return parts.map((text, i) => {
        const role: PathSegmentRole =
            i < last ? (i === 0 ? "ns" : "leaf") : /^\d+$/.test(text) ? "num" : "tail";
        return { text, role, path: parts.slice(0, i + 1).join(".") };
    });
}

/** One name, as the spec allows it (DTCG 2025.10 §5.1): not empty, no `.`, `{` or `}`, and `$` reserved but for `$root`. */
export function isSegment(name: string): boolean {
    if (name.length === 0 || /[.{}]/.test(name)) return false;
    return !name.startsWith("$") || name === ROOT_SEGMENT;
}

export function parentPath(path: string): string {
    const p = stripTrailingGlob(path);
    const lastDot = p.lastIndexOf(".");
    return lastDot === -1 ? "" : p.substring(0, lastDot);
}

export function resolveTerminalPath(path: string, getToken: (path: string) => unknown): string {
    const seen = new Set<string>();
    let current = path;
    while (true) {
        if (seen.has(current)) return current;
        seen.add(current);
        const next = unwrapRef(getToken(current));
        if (!next) return current;
        current = next;
    }
}
