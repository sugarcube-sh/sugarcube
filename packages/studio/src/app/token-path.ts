export function hrefFor(path: string): string {
    return `/${path.split(".").map(encodeURIComponent).join("/")}`;
}

function segmentsOf(pathname: string): string[] {
    return pathname.split("/").filter(Boolean).map(decodeURIComponent);
}

export function pathFromPathname(pathname: string): string | undefined {
    const segments = segmentsOf(pathname);
    return segments.length > 0 ? segments.join(".") : undefined;
}

export function ancestorsOf(pathname: string): string[] {
    const segments = segmentsOf(pathname);
    return segments.slice(0, -1).map((_, i) => segments.slice(0, i + 1).join("."));
}
