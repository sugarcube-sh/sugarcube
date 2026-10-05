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

/**
 * The rest of a path inside a group, or `undefined` when the path is not inside it. The group
 * itself is not inside, and neither is a sibling whose name merely starts the same way. The group
 * `""` is the top level, so every path is inside it.
 *
 * @example
 * pathBelow("color.brand.ink", "color") // "brand.ink"
 * pathBelow("colors.ink", "color")      // undefined
 */
export function pathBelow(path: string, group: string): string | undefined {
    if (group === "") return path;
    return path.startsWith(`${group}.`) ? path.slice(group.length + 1) : undefined;
}

export function within(path: string, group: string): boolean {
    return path === group || pathBelow(path, group) !== undefined;
}
