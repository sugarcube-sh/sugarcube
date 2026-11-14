import type { JsonValue } from "@sugarcube-sh/dtcg";

export function parseNumber(text: string): number | undefined {
    if (text.trim() === "") return undefined;
    const value = Number(text);
    return Number.isFinite(value) ? value : undefined;
}

export function parseJSON(text: string): { value: JsonValue } | undefined {
    try {
        return { value: JSON.parse(text) };
    } catch {
        return undefined;
    }
}
