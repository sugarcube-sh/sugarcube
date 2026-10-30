export function pathOnThisSite(given: string | null, site: string): string {
    if (!given?.startsWith("/")) return "/";
    const resolved = new URL(given, site);
    if (resolved.origin !== new URL(site).origin) return "/";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
