import { type DesignTokens, type Token, readFromMemory } from "../../src/index.js";
import { lightDark } from "../token-files.js";

export const px = (value: number) => ({ value, unit: "px" });
export const color = (value: unknown) => ({ $type: "color", $value: value });

export function read(files: Record<string, unknown>): DesignTokens {
    const texts = Object.fromEntries(
        Object.entries(files).map(([path, json]) => [path, JSON.stringify(json)]),
    );
    return readFromMemory({ files: texts }, { hexStringColors: true });
}

export function one(json: Record<string, unknown>): DesignTokens {
    return read({ "tokens.json": json });
}

export function themed(base: Record<string, unknown>, dark: Record<string, unknown>): DesignTokens {
    return readFromMemory(
        {
            files: {
                "tokens.resolver.json": lightDark(["base.json"], ["dark.json"]),
                "base.json": JSON.stringify(base),
                "dark.json": JSON.stringify(dark),
            },
        },
        { hexStringColors: true },
    );
}

export function tokenAt(tokens: DesignTokens, path: string, input = {}): Token {
    const found = tokens.getPermutation(input).getToken(path);
    if (!found) throw new Error(`no token at ${path}`);
    return found;
}
