import type { Alias, JsonPath, Pointer, Token } from "../index.js";
import { isAlias, isPlainObject, isPointer } from "../values/references.js";

/**
 * Every reference a token's value holds, and where in the value it sits: an {@link Alias} or a
 * {@link Pointer}, in the order the value lists them. `at` is the place in
 * {@link TokenBase.value | value}, which can differ from the file: a shadow written as one object
 * is a list of one, so a reference in its `color` is at `[0, "color"]`. A whole value written as a
 * reference is at `[]`. Empty for a token whose value could not be read.
 *
 * @example
 * // a border written { "color": "{color.brand}", "width": "{border.thin}", "style": "solid" }
 * references(border)
 * // [{ at: ["color"], ref: { alias: "color.brand" } }, { at: ["width"], ref: { alias: "border.thin" } }]
 */
export function references(token: Token): { at: JsonPath; ref: Alias | Pointer }[] {
    const found: { at: JsonPath; ref: Alias | Pointer }[] = [];
    const visit = (value: unknown, at: JsonPath) => {
        if (isAlias(value) || isPointer(value)) found.push({ at, ref: value });
        else if (Array.isArray(value)) value.forEach((item, index) => visit(item, [...at, index]));
        else if (isPlainObject(value)) {
            for (const [key, item] of Object.entries(value)) visit(item, [...at, key]);
        }
    };
    visit(token.value, []);
    return found;
}
