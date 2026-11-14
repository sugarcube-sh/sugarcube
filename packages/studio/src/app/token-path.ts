export function toHref(path: string): string {
    return `/${path.split(".").map(encodeURIComponent).join("/")}`;
}

function getSegments(pathname: string): string[] {
    return pathname.split("/").filter(Boolean).map(decodeURIComponent);
}

export function toTokenPath(pathname: string): string | undefined {
    const segments = getSegments(pathname);
    return segments.length > 0 ? segments.join(".") : undefined;
}

export function getAncestorPaths(pathname: string): string[] {
    const segments = getSegments(pathname);
    return segments.slice(0, -1).map((_, i) => segments.slice(0, i + 1).join("."));
}
