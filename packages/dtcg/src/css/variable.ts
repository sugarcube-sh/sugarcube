import { withoutRoot } from "../path.js";

export interface CSSVariableOptions {
    /** Put before every name, joined with a dash. */
    prefix?: string;
    /**
     * Makes the name from the path instead, without the leading `--`. It receives the path with a
     * final `$root` dropped, and its result is escaped like any other. `prefix` is then not used.
     *
     * @example
     * { name: (path) => path.replaceAll(".", "_") } // "color.brand" → "--color_brand"
     */
    name?: (path: string) => string;
}

/**
 * The name CSS knows a token path by, before any escaping: a final `$root` dropped (see
 * {@link withoutRoot}), each segment trimmed, spaces inside it made dashes, and the segments joined
 * with dashes. {@link cssVariable} is this with `--` and any prefix, escaped for a stylesheet; a
 * class name made from it is written plainly in markup and escaped only in its selector.
 *
 * @example
 * cssName("type.body copy.size")  // "type-body-copy-size"
 * cssName("color.accent.$root")   // "color-accent"
 * cssName("space.1/2")            // "space-1/2", escaped only where it is written
 */
export function cssName(path: string): string {
    return withoutRoot(path)
        .split(".")
        .map((segment) => segment.trim().replace(/\s+/g, "-"))
        .join("-");
}

/**
 * The CSS custom property for a token path: its {@link cssName}, so dots become dashes and a final
 * `$root` is dropped, as it names its group's own value, and anything a CSS name cannot hold is
 * escaped, so the name always works in a browser. A typography token's variables are this name, a
 * dash, and each CSS property {@link cssValue} gives it, such as `--type-body-font-size`.
 * Different paths can give the same name: `a.b-c` and `a-b.c` are both `--a-b-c`.
 *
 * @example
 * cssVariable("color.brand")                     // "--color-brand"
 * cssVariable("color.accent.$root")              // "--color-accent"
 * cssVariable("space.1/2")                       // "--space-1\\/2"
 * cssVariable("color.brand", { prefix: "ds" })   // "--ds-color-brand"
 */
export function cssVariable(path: string, options: CSSVariableOptions = {}): string {
    const named = options.name
        ? options.name(withoutRoot(path))
        : [...(options.prefix ? [options.prefix] : []), cssName(path)].join("-");
    return `--${escape(named)}`;
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
