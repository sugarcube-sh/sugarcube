import type { Move } from "./index.js";

const FORBIDDEN = [".", "{", "}"] as const;

/**
 * A token's path is its groups' names and its own, joined with dots: `color.brand.500`. These
 * follow the spec's rules, which are easy to get wrong by hand: a group can be named `""` (Format
 * 5.1), a `$root` token stands for its group (Format 6.2), and `color.brandy` is not inside
 * `color.brand`.
 *
 * @example
 * tokenPath.parent("color.brand.500")                  // "color.brand"
 * tokenPath.join("color.brand", "500")                 // "color.brand.500"
 * tokenPath.relative("color", "color.brand.ink")       // "brand.ink"
 * tokenPath.contains("color.brand", "color.brand.500") // true
 */
export const tokenPath = {
    /**
     * The group a token or group is directly inside, or `undefined` at the top level of the
     * files. A group may be named `""`, so `""` is that group's path, never the top level.
     *
     * @example
     * tokenPath.parent("color.brand.500") // "color.brand"
     * tokenPath.parent("color")           // undefined: at the top level
     * tokenPath.parent(".x")              // "": inside the group named ""
     */
    getParent(path: string): string | undefined {
        const dot = path.lastIndexOf(".");
        return dot === -1 ? undefined : path.slice(0, dot);
    },
    /**
     * The path of `name` inside `parent`, joined with a dot as the spec builds paths (Format
     * 6.7.2). Leave `parent` out for the top level.
     *
     * @example
     * tokenPath.join("color.brand", "500") // "color.brand.500"
     * tokenPath.join(undefined, "color")   // "color"
     */
    join(parent: string | undefined, name: string): string {
        return parent === undefined ? name : `${parent}.${name}`;
    },
    /**
     * The rest of `path` inside `group`, or `undefined` when it isn't inside: the group itself is
     * not, and neither is a sibling whose name merely starts the same way.
     *
     * @example
     * tokenPath.relative("color", "color.brand.ink") // "brand.ink"
     * tokenPath.relative("color", "colors.ink")      // undefined
     */
    relative(group: string, path: string): string | undefined {
        return path.startsWith(`${group}.`) ? path.slice(group.length + 1) : undefined;
    },
    /**
     * Whether `path` is `group` itself or anything within it (Format 6.3): what removing or moving
     * the group takes with it.
     *
     * @example
     * tokenPath.contains("color.brand", "color.brand.500") // true
     * tokenPath.contains("color.brand", "color.brand")     // true
     * tokenPath.contains("color.brand", "color.brandy")    // false
     */
    contains(group: string, path: string): boolean {
        return path === group || tokenPath.relative(group, path) !== undefined;
    },
    /**
     * The path a token stands for: a group's `$root` token gives its group's path, any other path
     * is returned as it is. For naming a token for people, such as a CSS custom property.
     *
     * @example
     * tokenPath.withoutRoot("color.accent.$root") // "color.accent"
     */
    removeRoot(path: string): string {
        return path.endsWith(".$root") ? path.slice(0, -".$root".length) : path;
    },
    /**
     * The character that stops `name` being a token or group name (Format 5.1.1), or `undefined`
     * when it can be one: a leading `$`, except `$root`, or a `.`, `{` or `}` anywhere.
     *
     * @example
     * tokenPath.invalidCharacter("brand.500") // "."
     * tokenPath.invalidCharacter("$root")     // undefined
     */
    findInvalidCharacter(name: string): "$" | (typeof FORBIDDEN)[number] | undefined {
        if (name.startsWith("$") && name !== "$root") return "$";
        return FORBIDDEN.find((each) => name.includes(each));
    },
    /**
     * Where a token or group is after a list of {@link Move}s, such as a rename, made in order. A
     * group's move carries everything inside it; a path no move reaches stays as it is. What
     * `tokens.diff` follows when told what moved.
     *
     * @example
     * tokenPath.afterMoves("color.brand.500", [{ from: "color.brand", to: "color.house" }])
     * // "color.house.500"
     */
    applyMoves(path: string, moved: readonly Move[]): string {
        return moved.reduce((current, { from, to }) => {
            if (current === from) return to;
            const rest = tokenPath.relative(from, current);
            return rest === undefined ? current : `${to}.${rest}`;
        }, path);
    },
} as const;
