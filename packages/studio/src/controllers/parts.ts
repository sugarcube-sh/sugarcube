import type { JsonPath, JsonValue, TokenType } from "@sugarcube-sh/dtcg";
import { compositeParts, isJsonObject, parseReference } from "@sugarcube-sh/dtcg/values";
import { removeListItem } from "./lists";
import type { Field } from "./value-field";

export type CompositeType = keyof typeof compositeParts;

export interface Slot {
    readonly part: JsonPath;
    readonly type: TokenType | "boolean";
    readonly value: JsonValue | undefined;
}

export interface FieldPart extends Slot {
    readonly name: string;
}

export type ListItem = { readonly part: JsonPath; readonly value: JsonValue } & (
    | { readonly display: "parts"; readonly parts: readonly FieldPart[] }
    | { readonly display: "reference" | "json" }
);

export type FieldWithParts =
    | { readonly kind: "parts"; readonly parts: readonly FieldPart[] }
    | {
          readonly kind: "list";
          readonly type: "shadow" | "gradient";
          readonly items: readonly ListItem[];
          readonly single: boolean;
      }
    | { readonly kind: "dashes"; readonly dashes: readonly Slot[]; readonly lineCap: string };

type ListField = Extract<FieldWithParts, { kind: "list" | "dashes" }>;

export function isComposite(type: TokenType): type is CompositeType {
    return Object.hasOwn(compositeParts, type);
}

export function hasParts(field: Field): field is FieldWithParts {
    return field.kind === "parts" || field.kind === "list" || field.kind === "dashes";
}

export function parseCompositeField(
    type: CompositeType,
    value: JsonValue,
): FieldWithParts | undefined {
    if (type === "shadow" || type === "gradient") {
        if (Array.isArray(value) && value.length > 0) {
            const items = value.map((each, index) => parseListItem(type, each, [index]));
            return { kind: "list", type, items, single: false };
        }
        return type === "shadow" && isJsonObject(value)
            ? { kind: "list", type, items: [parseListItem(type, value, [])], single: true }
            : undefined;
    }
    const parts = parseParts(type, value);
    return parts && { kind: "parts", parts };
}

export function parseDashesField(value: JsonValue): FieldWithParts | undefined {
    if (!isJsonObject(value)) return undefined;
    const { dashArray, lineCap, ...rest } = value;
    if (Object.keys(rest).length > 0 || !Array.isArray(dashArray) || dashArray.length === 0) {
        return undefined;
    }
    return {
        kind: "dashes",
        dashes: dashArray.map((dash, index) => ({
            part: ["dashArray", index],
            type: "dimension",
            value: dash,
        })),
        lineCap: typeof lineCap === "string" ? lineCap : "",
    };
}

export function parseParts(type: CompositeType, value: JsonValue): FieldPart[] | undefined {
    if (!isJsonObject(value)) return undefined;
    const parts: Readonly<Record<string, TokenType | "boolean">> = compositeParts[type];
    if (Object.keys(value).some((name) => !Object.hasOwn(parts, name))) return undefined;
    return Object.entries(parts).map(([name, partType]) => ({
        name,
        part: [name],
        type: partType,
        value: value[name],
    }));
}

export function toCompositeValue(field: FieldWithParts): JsonValue {
    switch (field.kind) {
        case "parts":
            return Object.fromEntries(
                field.parts.flatMap(({ name, value: written }) =>
                    written === undefined ? [] : [[name, written]],
                ),
            );
        case "list": {
            const items = getItemValues(field);
            const [only] = items;
            return field.single && items.length === 1 && only !== undefined ? only : items;
        }
        case "dashes":
            return toListValue(field, getItemValues(field));
    }
}

export function addFieldItem(field: ListField): JsonValue {
    const items = getItemValues(field);
    const last = items.at(-1);
    return toListValue(field, last === undefined ? items : [...items, last]);
}

export function removeFieldItem(field: ListField, at: number): JsonValue {
    return toListValue(field, removeListItem(getItemValues(field), at));
}

function parseListItem(type: "shadow" | "gradient", value: JsonValue, part: JsonPath): ListItem {
    if (parseReference(value)) return { part, value, display: "reference" };
    const parts = parseParts(type, value);
    return parts ? { part, value, display: "parts", parts } : { part, value, display: "json" };
}

function getItemValues(field: ListField): JsonValue[] {
    const items = field.kind === "list" ? field.items : field.dashes;
    return items.flatMap(({ value: written }) => (written === undefined ? [] : [written]));
}

function toListValue(field: ListField, items: JsonValue[]): JsonValue {
    if (field.kind === "list") return items;
    return field.lineCap === ""
        ? { dashArray: items }
        : { dashArray: items, lineCap: field.lineCap };
}
