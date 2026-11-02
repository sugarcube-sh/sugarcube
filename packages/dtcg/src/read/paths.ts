const schemeOrDrive = /^[a-z][a-z\d+.-]*:/i;

export function isAbsolute(path: string): boolean {
    return path.startsWith("/") || schemeOrDrive.test(path);
}

export function folderOf(path: string): string {
    const slash = path.lastIndexOf("/");
    return slash === -1 ? "" : path.slice(0, slash);
}

export function fileName(path: string): string {
    return path.slice(path.lastIndexOf("/") + 1);
}

export function normalise(path: string): string {
    if (isAbsolute(path)) return path;
    const segments: string[] = [];
    for (const segment of path.split("/")) {
        if (segment === "" || segment === ".") continue;
        if (segment === ".." && segments.length > 0 && segments.at(-1) !== "..") segments.pop();
        else segments.push(segment);
    }
    return segments.join("/");
}

export function join(folder: string, path: string): string {
    if (isAbsolute(path) || folder === "") return normalise(path);
    return normalise(`${folder}/${path}`);
}

/**
 * Where a file the design tokens name is: the file's name joined onto the folder of the entry they
 * were read from, the rule `read` follows when it asks for each file. A name written from the root,
 * or as a URL, is that place already, and comes back as it is. A file nothing has read yet, such as
 * one an edit creates, is found the same way.
 *
 * @param entry The resolver or token file the design tokens were read from, as given to `read`.
 * @param file A file as the design tokens name it, in `DesignTokens.files` or a `Span`.
 *
 * @example
 * filePath("tokens/tokens.resolver.json", "themes/dark.json") // "tokens/themes/dark.json"
 * filePath("tokens/tokens.resolver.json", "../shared/base.json") // "shared/base.json"
 * filePath("tokens/tokens.resolver.json", "/shared/brand.json") // "/shared/brand.json"
 */
export function getFilePath(entry: string, file: string): string {
    return join(folderOf(entry), file);
}
