/**
 * The path a token stands for: a group's own `$root` token gives its group's path (Format 6.2),
 * and any other path is returned as it is. A `$root` at the top of a file has no group name, so it
 * stays `$root`. Use it wherever a token is named for people, such as a CSS variable or a utility
 * class, so `color.accent.$root` reads as `color.accent`.
 *
 * @example
 * withoutRoot("color.accent.$root") // "color.accent"
 * withoutRoot("color.brand")        // "color.brand"
 */
export function withoutRoot(path: string): string {
    return path.endsWith(".$root") ? path.slice(0, -".$root".length) : path;
}
