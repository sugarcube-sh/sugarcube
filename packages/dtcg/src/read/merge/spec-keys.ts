import type { DiagnosticDetailByKind } from "../../model/diagnostic.js";
import type { JsonValue } from "../../model/json.js";
import { isJsonObject } from "../../values/json.js";

export type OwnProperty = DiagnosticDetailByKind["misspelt-property"]["property"];

export const OWN_PROPERTIES: readonly OwnProperty[] = [
    "$value",
    "$type",
    "$description",
    "$deprecated",
    "$extensions",
];

export type Property = Exclude<
    DiagnosticDetailByKind["invalid-property"]["property"],
    "$extends" | "$ref"
>;

export const EXPECTED: Record<Property, DiagnosticDetailByKind["invalid-property"]["expected"]> = {
    $type: "string",
    $description: "string",
    $deprecated: "boolean-or-string",
    $extensions: "object",
};

interface PropertyValue {
    $type: string;
    $description: string;
    $deprecated: boolean | string;
    $extensions: Record<string, JsonValue>;
}

export function isProperty(key: string): key is Property {
    return Object.hasOwn(EXPECTED, key);
}

export function readProperty<K extends Property>(
    key: K,
    raw: unknown,
): PropertyValue[K] | undefined {
    const expected = EXPECTED[key];
    const fits =
        expected === "string"
            ? typeof raw === "string"
            : expected === "boolean-or-string"
              ? typeof raw === "string" || typeof raw === "boolean"
              : isJsonObject(raw);
    return fits ? (raw as PropertyValue[K]) : undefined;
}

export const OTHER_SPEC_KEYS: ReadonlySet<string> = new Set(["$extends", "$ref", "$root"]);

const SPEC_KEYS: ReadonlySet<string> = new Set([...OWN_PROPERTIES, ...OTHER_SPEC_KEYS]);

const TOKEN_KEYS: ReadonlySet<string> = new Set(["$value", "$ref"]);

export function isSpecKey(key: string): boolean {
    return SPEC_KEYS.has(key);
}

export function isTokenKey(key: string): boolean {
    return TOKEN_KEYS.has(key);
}
