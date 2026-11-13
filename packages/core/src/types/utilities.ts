/**
 * Which sides a utility class sets.
 *
 * - `"top"`, `"right"`, `"bottom"` and `"left"` set one side, such as `.pt-sm`.
 * - `"x"` and `"y"` set two sides, such as `.px-sm`.
 * - `"all"` makes the plain class, such as `.p-sm`, and every side.
 * - `"full"` is deprecated. Use `"all"`.
 *
 * @see {@link https://sugarcube.sh/docs/utilities/#directional-utilities | Directional utilities}
 */
export type Direction = "top" | "right" | "bottom" | "left" | "x" | "y" | "full" | "all";

/**
 * One kind of utility class, made from a group of tokens.
 *
 * @see {@link https://sugarcube.sh/docs/reference/configuration-schema/#utility-config-options | Utility config options}
 *
 * @example
 * "background-color": { source: "color.*", prefix: "bg" }
 * // => .bg-primary { background-color: var(--color-primary) }
 */
export type UtilityClassConfig = {
    /**
     * The tokens to make classes from, such as `"color.*"`.
     */
    readonly source: string;
    /**
     * The sides to make classes for, such as `["x", "y"]`.
     *
     * Without it, one class sets the whole property.
     */
    readonly directions?: Direction | readonly Direction[];
    /**
     * The start of each class name, such as `"bg"`.
     *
     * @default the first name in `source`
     */
    readonly prefix?: string;
    /**
     * Drops the prefix when a token's name repeats it.
     *
     * @example
     * // source: "color.*", prefix: "text", for the token color.text.quiet
     * // => .text-quiet, not .text-text-quiet
     */
    readonly stripDuplicates?: boolean;
    /**
     * Makes classes even when no markup uses them.
     *
     * - `true` makes a class for every token under `source`.
     * - An array makes only the ones named, such as `["primary"]`.
     *
     * @see {@link https://sugarcube.sh/docs/utilities/#forcing-generation-with-safelist | Forcing generation with safelist}
     */
    readonly safelist?: boolean | readonly string[];
};
