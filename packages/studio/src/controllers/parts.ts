import type { JsonPath, JsonValue, TokenType } from "@sugarcube-sh/dtcg";
import { compositeParts, isJsonObject, parseReference } from "@sugarcube-sh/dtcg/values";
import { without } from "./lists";
import type { Field } from "./value-field";

export type CompositeType = keyof typeof compositeParts;

export interface Slot {
    readonly at: JsonPath;
    readonly type: TokenType | "boolean";
    readonly written: JsonValue | undefined;
}

export interface FieldPart extends Slot {
    readonly name: string;
}

export type ListItem = { readonly at: JsonPath; readonly written: JsonValue } & (
    | { readonly shown: "parts"; readonly parts: readonly FieldPart[] }
    | { readonly shown: "reference" | "json" }
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

type Listed = Extract<FieldWithParts, { kind: "list" | "dashes" }>;

export function isComposite(type: TokenType): type is CompositeType {
    return Object.hasOwn(compositeParts, type);
}

export function hasParts(field: Field): field is FieldWithParts {
    return field.kind === "parts" || field.kind === "list" || field.kind === "dashes";
}

export function compositeField(
    type: CompositeType,
    written: JsonValue,
): FieldWithParts | undefined {
    if (type === "shadow" || type === "gradient") {
        if (Array.isArray(written) && written.length > 0) {
            const items = written.map((each, index) => itemAt(type, each, [index]));
            return { kind: "list", type, items, single: false };
        }
        return type === "shadow" && isJsonObject(written)
            ? { kind: "list", type, items: [itemAt(type, written, [])], single: true }
            : undefined;
    }
    const parts = partsOf(type, written);
    return parts && { kind: "parts", parts };
}

export function dashesField(written: JsonValue): FieldWithParts | undefined {
    if (!isJsonObject(written)) return undefined;
    const { dashArray, lineCap, ...rest } = written;
    if (Object.keys(rest).length > 0 || !Array.isArray(dashArray) || dashArray.length === 0) {
        return undefined;
    }
    return {
        kind: "dashes",
        dashes: dashArray.map((dash, index) => ({
            at: ["dashArray", index],
            type: "dimension",
            written: dash,
        })),
        lineCap: typeof lineCap === "string" ? lineCap : "",
    };
}

export function partsOf(type: CompositeType, written: JsonValue): FieldPart[] | undefined {
    if (!isJsonObject(written)) return undefined;
    const parts: Readonly<Record<string, TokenType | "boolean">> = compositeParts[type];
    if (Object.keys(written).some((name) => !Object.hasOwn(parts, name))) return undefined;
    return Object.entries(parts).map(([name, partType]) => ({
        name,
        at: [name],
        type: partType,
        written: written[name],
    }));
}

export function writtenWithParts(field: FieldWithParts): JsonValue {
    switch (field.kind) {
        case "parts":
            return Object.fromEntries(
                field.parts.flatMap(({ name, written }) =>
                    written === undefined ? [] : [[name, written]],
                ),
            );
        case "list": {
            const items = writtenItems(field);
            const [only] = items;
            return field.single && items.length === 1 && only !== undefined ? only : items;
        }
        case "dashes":
            return listedAs(field, writtenItems(field));
    }
}

export function withAdded(field: Listed): JsonValue {
    const items = writtenItems(field);
    const last = items.at(-1);
    return listedAs(field, last === undefined ? items : [...items, last]);
}

export function withRemoved(field: Listed, at: number): JsonValue {
    return listedAs(field, without(writtenItems(field), at));
}

function itemAt(type: "shadow" | "gradient", written: JsonValue, at: JsonPath): ListItem {
    if (parseReference(written)) return { at, written, shown: "reference" };
    const parts = partsOf(type, written);
    return parts ? { at, written, shown: "parts", parts } : { at, written, shown: "json" };
}

function writtenItems(field: Listed): JsonValue[] {
    const items = field.kind === "list" ? field.items : field.dashes;
    return items.flatMap(({ written }) => (written === undefined ? [] : [written]));
}

function listedAs(field: Listed, items: JsonValue[]): JsonValue {
    if (field.kind === "list") return items;
    return field.lineCap === ""
        ? { dashArray: items }
        : { dashArray: items, lineCap: field.lineCap };
}
