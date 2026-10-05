import type { IgnoredProperty, JsonPath, ParseOptions, TokenType, ValueError } from "../index.js";
import { ignoredProperty, valueError } from "./value-errors.js";

export function unknownProperties(
    raw: Record<string, unknown>,
    defines: (name: string) => boolean,
    type: TokenType,
    at: JsonPath,
    errors: ValueError[],
    options: ParseOptions | undefined,
): IgnoredProperty[] {
    const ignored: IgnoredProperty[] = [];
    for (const name of Object.keys(raw)) {
        if (defines(name)) continue;
        const path = [...at, name];
        if (name === "$ref") errors.push(valueError(path, { type, reason: "pointer-not-alone" }));
        else if (options?.ignoreUnknownProperties) ignored.push(ignoredProperty(path, type, name));
        else errors.push(valueError(path, { type, reason: "unknown-property", property: name }));
    }
    return ignored;
}
