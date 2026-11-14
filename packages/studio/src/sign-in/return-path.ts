export function getSafeReturnPath(returnPath: string | null, siteOrigin: string): string {
    if (!returnPath?.startsWith("/")) return "/";
    const resolved = new URL(returnPath, siteOrigin);
    if (resolved.origin !== new URL(siteOrigin).origin) return "/";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
