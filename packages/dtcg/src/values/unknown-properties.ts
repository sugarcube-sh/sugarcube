import type { IgnoredProperty, JsonPath, ParseOptions, TokenType, ValueError } from "../model.js";
import { ignoredProperty, valueError } from "./value-errors.js";

export function unknownProperties(
    raw: Record<string, unknown>,
    isKnownProperty: (name: string) => boolean,
    type: TokenType,
    jsonPath: JsonPath,
    errors: ValueError[],
    options: ParseOptions,
): IgnoredProperty[] {
    const ignored: IgnoredProperty[] = [];
    for (const name of Object.keys(raw)) {
        if (isKnownProperty(name)) continue;
        const path = [...jsonPath, name];
        if (name === "$ref") errors.push(valueError(path, { type, reason: "pointer-not-alone" }));
        else if (options.ignoreUnknownProperties) ignored.push(ignoredProperty(path, type, name));
        else errors.push(valueError(path, { type, reason: "unknown-property", property: name }));
    }
    return ignored;
}
