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
 * Works out where a file the tokens name is.
 *
 * It joins the file onto the entry file's folder, as `read` does. A path from the root, or a URL,
 * stays as it is.
 *
 * @param entryFile - The file the tokens were read from, such as `"tokens/tokens.resolver.json"`.
 * @param file - A file in `tokens.files` or a `Span`, such as `"dark.json"`.
 *
 * @example
 * // A file next to the resolver
 * getFilePath("tokens/tokens.resolver.json", "dark.json")
 * // => "tokens/dark.json"
 */
export function getFilePath(entryFile: string, file: string): string {
    return join(folderOf(entryFile), file);
}
