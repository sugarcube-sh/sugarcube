export function buildExtensionGlob(extensions: string[]): string {
    const exts = [
        ...new Set(extensions.map((ext) => ext.replace(/^\.+/, "").toLowerCase()).filter(Boolean)),
    ];
    if (exts.length === 0) return "**/*";
    const group = exts.length === 1 ? exts[0] : `{${exts.join(",")}}`;
    return `**/*.${group}`;
}
