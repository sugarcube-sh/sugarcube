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
 * Where a file the Document names was read from: the file's name joined onto the folder of the
 * entry, as given to `read`. A name written from the root, or as a URL, is that place already,
 * and comes back as it is.
 *
 * @param folder The entry's folder, such as `"tokens"` for `read("tokens/tokens.resolver.json")`.
 * @param file A file as the Document names it, in `Document.files` or a `Span`.
 *
 * @example
 * filePath("tokens", "themes/dark.json") // "tokens/themes/dark.json"
 * filePath("tokens", "../shared/base.json") // "shared/base.json"
 * filePath("tokens", "/shared/brand.json") // "/shared/brand.json"
 */
export function filePath(folder: string, file: string): string {
    return join(folder, file);
}
