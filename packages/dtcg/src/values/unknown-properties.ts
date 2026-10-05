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
        if (name !== "$ref" && !options?.ignoreUnknownProperties) {
            errors.push(
                valueError([...at, name], { type, reason: "unknown-property", property: name }),
            );
            continue;
        }
        if (name === "$ref")
            errors.push(valueError([...at, name], { type, reason: "pointer-not-alone" }));
        else ignored.push(ignoredProperty([...at, name], type, name));
    }
    return ignored;
}
