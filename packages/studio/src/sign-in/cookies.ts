export type CookieOptions = {
    readonly maxAge: number;
    readonly path: string;
    readonly httpOnly: boolean;
    readonly secure: boolean;
};

export function getRequestCookie(request: Request, name: string): string | undefined {
    return getCookie(request.headers.get("cookie") ?? "", name);
}

export function getCookie(header: string, name: string): string | undefined {
    for (const part of header.split(";")) {
        const at = part.indexOf("=");
        if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
    }
    return undefined;
}

export function serializeCookie(
    name: string,
    value: string,
    { maxAge, path, httpOnly, secure }: CookieOptions,
): string {
    return [
        `${name}=${value}`,
        `Path=${path}`,
        `Max-Age=${maxAge}`,
        "SameSite=Lax",
        ...(httpOnly ? ["HttpOnly"] : []),
        ...(secure ? ["Secure"] : []),
    ].join("; ");
}
