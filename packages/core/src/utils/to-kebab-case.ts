const kebabCache = new Map<string, string>();

export function toKebabCase(str: string): string {
    const cached = kebabCache.get(str);
    if (cached) return cached;

    const kebab = str
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z])(?=[a-z])/g, "$1-$2")
        .toLowerCase();

    kebabCache.set(str, kebab);
    return kebab;
}
