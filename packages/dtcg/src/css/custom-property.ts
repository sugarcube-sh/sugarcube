import { tokenPath } from "../path.js";

/** How a token path becomes a custom property's name. */
export interface CSSNaming {
    /**
     * Text put before every name, such as `"ds"`.
     *
     * It's joined by `delimiter` like the rest of the name. `case` never changes it.
     */
    prefix?: string;
    /**
     * Writes each name in the path in kebab case.
     *
     * `brandPrimary` becomes `brand-primary`, and `XMLParser` becomes `xml-parser`. Without it,
     * names stay as written.
     */
    case?: "kebab";
    /**
     * The text between the parts of a name.
     *
     * Dashes already in a name stay. With `"_"`, `button.hover-background` becomes
     * `--button_hover-background`.
     *
     * @default "-"
     */
    delimiter?: string;
    /**
     * Makes each name your own way, in place of these settings.
     *
     * It gets the path without a final `$root`, and returns the name without `--`. `prefix` and
     * `case` aren't used.
     *
     * @example
     * // Underscores between the names in the path
     * toCustomPropertyName("color.primary", { getName: (path) => path.replaceAll(".", "_") })
     * // => "--color_primary"
     */
    getName?: (path: string) => string;
}

/** How to name a token's custom property. */
export interface CSSCustomPropertyOptions extends CSSNaming {
    /**
     * For a typography token, the CSS property this custom property is for.
     *
     * It goes on the end of the name. `"font-size"` makes `--type-body-font-size` for `type.body`.
     */
    cssProperty?: string;
}

/**
 * Turns a token path into a CSS name, such as a class name.
 *
 * It's {@link toCustomPropertyName} without the `--`, a prefix or escaping.
 *
 * @param path - A token path, such as `"type.body copy.size"`.
 *
 * @example
 * // Spaces become dashes
 * toCSSIdentifier("type.body copy.size")
 * // => "type-body-copy-size"
 */
export function toCSSIdentifier(path: string): string {
    return named(path, {});
}

/**
 * Gives the CSS custom property name for a token path.
 *
 * The names in the path are joined with dashes, and a final `$root` is dropped. `a.b-c` and `a-b.c`
 * give the same name.
 *
 * @param path - A token path, such as `"color.primary"`.
 * @param options - How to name it, such as `{ prefix: "ds" }`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#translation-tools | Format 6.10.3, Translation tools}
 *
 * @example
 * // A plain path
 * toCustomPropertyName("color.primary")
 * // => "--color-primary"
 *
 * @example
 * // A character CSS names can't contain is escaped
 * toCustomPropertyName("space.1/2")
 * // => "--space-1\\/2"
 */
export function toCustomPropertyName(path: string, options: CSSCustomPropertyOptions = {}): string {
    return `--${escape(named(path, options))}`;
}

function named(
    path: string,
    { prefix, case: casing, delimiter = "-", getName, cssProperty }: CSSCustomPropertyOptions,
): string {
    let whole = getName
        ? getName(tokenPath.removeRoot(path))
        : tokenPath
              .removeRoot(path)
              .split(".")
              .map((segment) => words(segment, casing, delimiter))
              .join(delimiter);
    if (!getName && prefix) whole = `${prefix}${delimiter}${whole}`;
    return cssProperty ? `${whole}${delimiter}${cssProperty}` : whole;
}

function words(segment: string, casing: "kebab" | undefined, delimiter: string): string {
    let spaced = segment.trim();
    if (casing === "kebab") {
        spaced = spaced
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .replace(/([A-Z])([A-Z])(?=[a-z])/g, "$1 $2")
            .toLowerCase();
    }
    return /\s/.test(spaced) ? spaced.replace(/\s+/g, () => delimiter) : spaced;
}

function escape(name: string): string {
    if (/^[\w-]*$/.test(name)) return name;
    let escaped = "";
    for (const character of name) {
        const code = character.charCodeAt(0);
        if (code === 0) escaped += "\uFFFD";
        else if (code < 0x20 || code === 0x7f) escaped += `\\${code.toString(16)} `;
        else if (code >= 0x80 || /[\w-]/.test(character)) escaped += character;
        else escaped += `\\${character}`;
    }
    return escaped;
}
