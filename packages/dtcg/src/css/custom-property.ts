import { tokenPath } from "../path.js";

/** How a token path becomes a CSS custom property's name, as settings any tool can pass on. */
export interface CSSNaming {
    /** Put before every name, joined like any other part, and never changed by `case`. */
    prefix?: string;
    /**
     * `"kebab"` splits each name in the path at its camelCase and PascalCase words and writes them
     * in lowercase: `brandPrimary` is `brand-primary`, `XMLParser` is `xml-parser`, `60Hover` is
     * `60-hover`. Without it, names are as written.
     */
    case?: "kebab";
    /**
     * What joins the parts: the prefix, the names in the path, the words `case` or a space splits
     * a name into, and a typography custom property's CSS property. Characters already in a name are kept,
     * so `color.brand-primary` with `"_"` is `--color_brand-primary`.
     * @default "-"
     */
    delimiter?: string;
    /**
     * Makes the name from the path instead, without the leading `--`, for a tool whose names no
     * settings describe. It receives the path with a final `$root` dropped, and its result is
     * escaped like any other. `prefix` and `case` are then not used; `delimiter` still joins a
     * typography custom property's CSS property.
     *
     * @example
     * { name: (path) => path.replaceAll(".", "_") } // "color.brand" → "--color_brand"
     */
    getName?: (path: string) => string;
}

/** A token's CSS custom property: its naming, and for typography the CSS property it is one of. */
export interface CSSCustomPropertyOptions extends CSSNaming {
    /**
     * The CSS property this custom property holds of a typography token, which {@link cssValue}
     * writes as one custom property per CSS property: `"font-size"` gives `--type-body-font-size`.
     */
    cssProperty?: string;
}

/**
 * The name CSS knows a token path by, before any escaping: a final `$root` dropped (see
 * `tokenPath.withoutRoot`), each segment trimmed, spaces inside it made dashes, and the segments joined
 * with dashes. {@link toCustomPropertyName} is this with `--` and any prefix, escaped for a stylesheet; a
 * class name made from it is written plainly in markup and escaped only in its selector.
 *
 * @example
 * cssIdentifier("type.body copy.size")  // "type-body-copy-size"
 * cssIdentifier("color.accent.$root")   // "color-accent"
 * cssIdentifier("space.1/2")            // "space-1/2", escaped only where it is written
 */
export function toCSSIdentifier(path: string): string {
    return named(path, {});
}

/**
 * The CSS custom property for a token path, named from the path as DTCG asks of translation tools
 * (Format §6.10.3): a final `$root` dropped, as it names its group's own value, the names in the
 * path joined with dashes (or the `delimiter`), and anything a CSS name cannot hold escaped, so
 * the name always works in a browser. A typography token's custom properties are this name joined to each
 * CSS property {@link cssValue} gives it, such as `--type-body-font-size`. Different paths can
 * give the same name: `a.b-c` and `a-b.c` are both `--a-b-c`, and with `case: "kebab"`,
 * `fooBar` and `foo-bar` are too.
 *
 * @example
 * cssCustomProperty("color.brand")                                // "--color-brand"
 * cssCustomProperty("color.accent.$root")                         // "--color-accent"
 * cssCustomProperty("space.1/2")                                  // "--space-1\\/2"
 * cssCustomProperty("color.brand", { prefix: "ds" })              // "--ds-color-brand"
 * cssCustomProperty("color.brandPrimary", { case: "kebab" })      // "--color-brand-primary"
 * cssCustomProperty("color.brand", { delimiter: "_" })            // "--color_brand"
 * cssCustomProperty("type.body", { cssProperty: "font-size" })    // "--type-body-font-size"
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
