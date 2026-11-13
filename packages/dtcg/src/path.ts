import type { Move } from "./model/change.js";

const FORBIDDEN = [".", "{", "}"] as const;

type InvalidCharacter = "$" | (typeof FORBIDDEN)[number];

/**
 * Reads and builds token paths.
 *
 * A path is the names of a token's groups and its own, joined with dots, such as `color.blue.500`.
 * These follow the spec's rules. So `color.bluegrey` isn't inside `color.blue`. The top level of a
 * file is the group at `""`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#path-construction | Format 6.7.2, Path Construction}
 *
 * @example
 * // The group color.blue.500 is in
 * tokenPath.getParent("color.blue.500")
 * // => "color.blue"
 */
export const tokenPath = {
    /**
     * Gets the group a path is directly inside.
     *
     * A name at the top of a file is inside the top level, whose path is `""`. The top level is
     * inside nothing, so for `""` it returns `undefined`.
     *
     * @param path - The path, such as `"color.blue.500"`.
     *
     * @example
     * // Inside color.blue
     * tokenPath.getParent("color.blue.500")
     * // => "color.blue"
     *
     * @example
     * // At the top of a file
     * tokenPath.getParent("color")
     * // => ""
     */
    getParent(path: string): string | undefined {
        if (path === "") return undefined;
        const dot = path.lastIndexOf(".");
        return dot === -1 ? "" : path.slice(0, dot);
    },
    /**
     * Gets the last name in a path.
     *
     * @param path - The path, such as `"color.blue.500"`.
     *
     * @example
     * // The token's own name
     * tokenPath.getName("color.blue.500")
     * // => "500"
     */
    getName(path: string): string {
        return path.slice(path.lastIndexOf(".") + 1);
    },
    /**
     * Joins a group's path and a name into a path.
     *
     * @param parent - The group, such as `"color.blue"`, or `""` for the top level.
     * @param name - The name, such as `"500"`.
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#path-construction | Format 6.7.2, Path Construction}
     *
     * @example
     * // A token in color.blue
     * tokenPath.join("color.blue", "500")
     * // => "color.blue.500"
     */
    join(parent: string, name: string): string {
        return parent === "" ? name : `${parent}.${name}`;
    },
    /**
     * Gets the rest of a path inside a group.
     *
     * It returns `undefined` if the path isn't inside. The group's own path isn't inside it. Every
     * other path is inside the top level, `""`.
     *
     * @param group - The group, such as `"color"`.
     * @param path - The path, such as `"color.blue.500"`.
     *
     * @example
     * // A token inside color
     * tokenPath.relative("color", "color.blue.500")
     * // => "blue.500"
     *
     * @example
     * // A name that only starts the same
     * tokenPath.relative("color.blue", "color.bluegrey.500")
     * // => undefined
     */
    relative(group: string, path: string): string | undefined {
        if (group === "") return path === "" ? undefined : path;
        return path.startsWith(`${group}.`) ? path.slice(group.length + 1) : undefined;
    },
    /**
     * Checks whether a path is a group, or inside it.
     *
     * @param group - The group, such as `"color.blue"`.
     * @param path - The path, such as `"color.blue.500"`.
     *
     * @example
     * // A token in the group
     * tokenPath.contains("color.blue", "color.blue.500")
     * // => true
     *
     * @example
     * // The group itself counts
     * tokenPath.contains("color.blue", "color.blue")
     * // => true
     */
    contains(group: string, path: string): boolean {
        return path === group || tokenPath.relative(group, path) !== undefined;
    },
    /**
     * Removes `.$root` from the end of a path.
     *
     * So for a group's `$root` token, it returns the group's path. Any other path is returned as it
     * is.
     *
     * @param path - The path, such as `"color.blue.$root"`.
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#root-tokens-in-groups | Format 6.2, Root Tokens in Groups}
     *
     * @example
     * // The $root token of color.blue
     * tokenPath.removeRoot("color.blue.$root")
     * // => "color.blue"
     */
    removeRoot(path: string): string {
        return path.endsWith(".$root") ? path.slice(0, -".$root".length) : path;
    },
    /**
     * Finds the character that stops a name being valid.
     *
     * It returns `undefined` if the name is valid. A name can't start with `$`, unless it's
     * `$root`. It can't have `.`, `{` or `}` anywhere.
     *
     * @param name - A token or group name, such as `"500"`.
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#character-restrictions | Format 5.1.1, Character restrictions}
     *
     * @example
     * // A dot in a name
     * tokenPath.findInvalidCharacter("blue.500")
     * // => "."
     */
    findInvalidCharacter(name: string): InvalidCharacter | undefined {
        if (name.startsWith("$") && name !== "$root") return "$";
        return FORBIDDEN.find((each) => name.includes(each));
    },
    /**
     * Finds what stops a name being valid, as the facts an `invalid-name` problem gives.
     *
     * It returns `undefined` if the name is valid. A name can't be empty, which gives `{}`, and
     * can't have a character {@link findInvalidCharacter} finds, which gives that `character`.
     *
     * @param name - A token or group name, such as `"500"`.
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#character-restrictions | Format 5.1.1, Character restrictions}
     *
     * @example
     * // A dot in a name
     * tokenPath.findNameProblem("blue.500")
     * // => { character: "." }
     */
    findNameProblem(name: string): { readonly character?: InvalidCharacter } | undefined {
        if (name === "") return {};
        const character = tokenPath.findInvalidCharacter(name);
        return character === undefined ? undefined : { character };
    },
    /**
     * Tells whether a token or group can have this name.
     *
     * It's `true` when {@link findNameProblem} finds nothing.
     *
     * @param name - A token or group name, such as `"500"`.
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#character-restrictions | Format 5.1.1, Character restrictions}
     *
     * @example
     * // An empty name
     * tokenPath.isValidName("")
     * // => false
     */
    isValidName(name: string): boolean {
        return tokenPath.findNameProblem(name) === undefined;
    },
    /**
     * Works out where a path is after some moves.
     *
     * Moves are made in order. Moving a group moves everything inside it.
     *
     * @param path - The path, such as `"color.blue.500"`.
     * @param moves - The {@link Move}s, such as `[{ from: "color.blue", to: "color.azure" }]`.
     *
     * @example
     * // After renaming color.blue
     * tokenPath.applyMoves("color.blue.500", [{ from: "color.blue", to: "color.azure" }])
     * // => "color.azure.500"
     */
    applyMoves(path: string, moves: readonly Move[]): string {
        return moves.reduce((current, { from, to }) => {
            if (current === from) return to;
            const rest = tokenPath.relative(from, current);
            return rest === undefined ? current : `${to}.${rest}`;
        }, path);
    },
} as const;
