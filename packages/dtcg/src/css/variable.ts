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
 * The CSS custom property for a token path: dots become dashes, a final `$root` is dropped, as it
 * names its group's own value, and anything a CSS name cannot hold is escaped, so the name always
 * works in a browser. A typography token's variables are this name, a dash, and each CSS property
 * {@link cssValue} gives it, such as `--type-body-font-size`.
 *
 * @example
 * cssVariable("color.brand")                     // "--color-brand"
 * cssVariable("color.accent.$root")              // "--color-accent"
 * cssVariable("space.1/2")                       // "--space-1\\/2"
 * cssVariable("color.brand", { prefix: "ds" })   // "--ds-color-brand"
 */
export function cssVariable(path: string, options: CSSVariableOptions = {}): string {
    const own = path.endsWith(".$root") ? path.slice(0, -".$root".length) : path;
    const named = options.name
        ? options.name(own)
        : [
              ...(options.prefix ? [options.prefix] : []),
              ...own.split(".").map((segment) => segment.trim().replace(/\s+/g, "-")),
          ].join("-");
    return `--${escape(named)}`;
}

function escape(name: string): string {
    let escaped = "";
    for (const character of name) {
        const code = character.codePointAt(0) ?? 0;
        if (code === 0) escaped += "�";
        else if (code < 0x20 || code === 0x7f) escaped += `\\${code.toString(16)} `;
        else if (code >= 0x80 || /[\w-]/.test(character)) escaped += character;
        else escaped += `\\${character}`;
    }
    return escaped;
}
