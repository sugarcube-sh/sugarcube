import type { DiagnosticDetailByKind } from "../../model/diagnostic.js";

export type OwnProperty = DiagnosticDetailByKind["misspelt-property"]["property"];

export const OWN_PROPERTIES: readonly OwnProperty[] = [
    "$value",
    "$type",
    "$description",
    "$deprecated",
    "$extensions",
];

export const OTHER_SPEC_KEYS: ReadonlySet<string> = new Set(["$extends", "$ref", "$root"]);

const SPEC_KEYS: ReadonlySet<string> = new Set([...OWN_PROPERTIES, ...OTHER_SPEC_KEYS]);

const TOKEN_KEYS: ReadonlySet<string> = new Set(["$value", "$ref"]);

export function isSpecKey(key: string): boolean {
    return SPEC_KEYS.has(key);
}

export function isTokenKey(key: string): boolean {
    return TOKEN_KEYS.has(key);
}
