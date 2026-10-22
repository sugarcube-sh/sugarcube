import type {
    CubicBezierValue,
    DimensionValue,
    DurationValue,
    JsonValue,
    StrokeStyleValue,
    TokenType,
} from "@sugarcube-sh/dtcg";
import {
    type FontWeightKeyword,
    dimensionUnits,
    durationUnits,
    fontWeightKeywords,
    parseValue,
    readReference,
    strokeStyleKeywords,
} from "@sugarcube-sh/dtcg/values";
import { type ColorDraft, type ColorField, colorDraft, colorField, colorFrom } from "./color";
import {
    type FieldWithParts,
    compositeField,
    dashesField,
    isComposite,
    writtenWithParts,
} from "./parts";
import { numberIn } from "./typed-text";

type StrokeStyleKeyword = Extract<StrokeStyleValue, { kind: "keyword" }>["keyword"];

export type Field =
    | { readonly kind: "dimension"; readonly value: number; readonly unit: DimensionValue["unit"] }
    | { readonly kind: "duration"; readonly value: number; readonly unit: DurationValue["unit"] }
    | { readonly kind: "number"; readonly value: number }
    | { readonly kind: "fontWeight"; readonly value: number | FontWeightKeyword }
    | { readonly kind: "fontFamily"; readonly fonts: readonly string[]; readonly alone: boolean }
    | { readonly kind: "cubicBezier"; readonly points: CubicBezierValue }
    | { readonly kind: "strokeStyle"; readonly keyword: StrokeStyleKeyword }
    | { readonly kind: "reference"; readonly path: string }
    | ColorField
    | FieldWithParts
    | { readonly kind: "json"; readonly value: JsonValue };

export type FieldType = Exclude<Field["kind"], "reference" | "json" | FieldWithParts["kind"]>;

export type Draft =
    | { readonly kind: "dimension" | "duration"; readonly amount: string; readonly unit: string }
    | { readonly kind: "number"; readonly amount: string }
    | {
          readonly kind: "fontWeight";
          readonly choice: FontWeightKeyword | "number" | "";
          readonly amount: string;
      }
    | { readonly kind: "fontFamily"; readonly fonts: readonly string[]; readonly alone: boolean }
    | { readonly kind: "cubicBezier"; readonly points: readonly [string, string, string, string] }
    | { readonly kind: "strokeStyle"; readonly keyword: string }
    | ColorDraft;

const fieldTypes = {
    dimension: true,
    duration: true,
    number: true,
    fontWeight: true,
    fontFamily: true,
    cubicBezier: true,
    strokeStyle: true,
    color: true,
} satisfies Record<FieldType, true>;

export const weightKeywords = Object.keys(fontWeightKeywords) as FontWeightKeyword[];

export function hasField(type: TokenType): type is FieldType {
    return Object.hasOwn(fieldTypes, type);
}

export function fieldFor(type: TokenType | undefined, written: JsonValue): Field {
    const json: Field = { kind: "json", value: written };
    if (type === undefined) return json;
    const reference = readReference(written);
    if (reference) {
        return reference.syntax === "curly-brace"
            ? { kind: "reference", path: reference.path }
            : json;
    }
    if (isComposite(type)) return compositeField(type, written) ?? json;
    if (type === "strokeStyle") {
        const dashes = dashesField(written);
        if (dashes) return dashes;
    }
    if (!hasField(type)) return json;
    return literalField(type, written) ?? json;
}

function literalField(type: FieldType, written: JsonValue): Field | undefined {
    switch (type) {
        case "dimension": {
            const read = parseValue(type, written, [], { references: false });
            return read.ok
                ? { kind: type, value: read.value.value, unit: read.value.unit }
                : undefined;
        }
        case "duration": {
            const read = parseValue(type, written, [], { references: false });
            return read.ok
                ? { kind: type, value: read.value.value, unit: read.value.unit }
                : undefined;
        }
        case "number": {
            const read = parseValue(type, written, [], { references: false });
            return read.ok ? { kind: type, value: read.value } : undefined;
        }
        case "fontWeight": {
            const read = parseValue(type, written, [], { references: false });
            if (!read.ok) return undefined;
            const keyword = weightKeywords.find((each) => each === written);
            return { kind: type, value: keyword ?? read.value };
        }
        case "fontFamily": {
            const read = parseValue(type, written, [], { references: false });
            return read.ok
                ? { kind: type, fonts: read.value, alone: typeof written === "string" }
                : undefined;
        }
        case "cubicBezier": {
            const read = parseValue(type, written, [], { references: false });
            return read.ok ? { kind: type, points: read.value } : undefined;
        }
        case "strokeStyle": {
            const read = parseValue(type, written, [], { references: false });
            return read.ok && read.value.kind === "keyword"
                ? { kind: type, keyword: read.value.keyword }
                : undefined;
        }
        case "color":
            return colorField(written);
    }
}

export function writtenFor(field: Field): JsonValue {
    switch (field.kind) {
        case "dimension":
        case "duration":
            return { value: field.value, unit: field.unit };
        case "number":
        case "fontWeight":
            return field.value;
        case "fontFamily": {
            const [only] = field.fonts;
            return field.alone && field.fonts.length === 1 && only !== undefined
                ? only
                : [...field.fonts];
        }
        case "cubicBezier":
            return [...field.points];
        case "strokeStyle":
            return field.keyword;
        case "reference":
            return `{${field.path}}`;
        case "color":
            return field.written;
        case "parts":
        case "list":
        case "dashes":
            return writtenWithParts(field);
        case "json":
            return field.value;
    }
}

export function changes(field: Field, written: JsonValue | undefined): boolean {
    return written === undefined || !same(writtenFor(field), written);
}

export function draftFor(type: FieldType, field: Field | undefined): Draft {
    switch (type) {
        case "dimension":
        case "duration":
            return field?.kind === type
                ? { kind: type, amount: String(field.value), unit: field.unit }
                : { kind: type, amount: "", unit: "" };
        case "number":
            return { kind: type, amount: field?.kind === type ? String(field.value) : "" };
        case "fontWeight": {
            if (field?.kind !== type) return { kind: type, choice: "", amount: "" };
            const { value } = field;
            return typeof value === "number"
                ? { kind: type, choice: "number", amount: String(value) }
                : { kind: type, choice: value, amount: String(fontWeightKeywords[value]) };
        }
        case "fontFamily":
            return field?.kind === type
                ? { kind: type, fonts: field.fonts, alone: field.alone }
                : { kind: type, fonts: [""], alone: true };
        case "cubicBezier": {
            if (field?.kind !== type) return { kind: type, points: ["", "", "", ""] };
            const [a, b, c, d] = field.points;
            return { kind: type, points: [String(a), String(b), String(c), String(d)] };
        }
        case "strokeStyle":
            return { kind: type, keyword: field?.kind === type ? field.keyword : "" };
        case "color":
            return colorDraft(field?.kind === type ? field : undefined);
    }
}

export function fieldFrom(draft: Draft): Field | undefined {
    switch (draft.kind) {
        case "dimension": {
            const value = numberIn(draft.amount);
            const unit = dimensionUnits.find((each) => each === draft.unit);
            return value === undefined || unit === undefined
                ? undefined
                : { kind: draft.kind, value, unit };
        }
        case "duration": {
            const value = numberIn(draft.amount);
            const unit = durationUnits.find((each) => each === draft.unit);
            return value === undefined || unit === undefined
                ? undefined
                : { kind: draft.kind, value, unit };
        }
        case "number": {
            const value = numberIn(draft.amount);
            return value === undefined ? undefined : { kind: draft.kind, value };
        }
        case "fontWeight": {
            if (draft.choice === "") return undefined;
            if (draft.choice !== "number") return { kind: draft.kind, value: draft.choice };
            const value = numberIn(draft.amount);
            return value === undefined ? undefined : { kind: draft.kind, value };
        }
        case "fontFamily":
            return draft.fonts.length > 0 && draft.fonts.every((name) => name !== "")
                ? { kind: draft.kind, fonts: draft.fonts, alone: draft.alone }
                : undefined;
        case "cubicBezier": {
            const [a, b, c, d] = draft.points.map(numberIn);
            return a === undefined || b === undefined || c === undefined || d === undefined
                ? undefined
                : { kind: draft.kind, points: [a, b, c, d] };
        }
        case "strokeStyle": {
            const keyword = strokeStyleKeywords.find((each) => each === draft.keyword);
            return keyword === undefined ? undefined : { kind: draft.kind, keyword };
        }
        case "color":
        case "hexColor":
            return colorFrom(draft);
    }
}

export function withPoint(
    draft: Extract<Draft, { kind: "cubicBezier" }>,
    index: number,
    text: string,
): Extract<Draft, { kind: "cubicBezier" }> {
    const [a, b, c, d] = draft.points;
    const at = (here: number, was: string) => (here === index ? text : was);
    return { ...draft, points: [at(0, a), at(1, b), at(2, c), at(3, d)] };
}

export function says(draft: Draft, field: Field | undefined): boolean {
    const made = fieldFrom(draft);
    return made === undefined || field === undefined
        ? made === field
        : same(writtenFor(made), writtenFor(field));
}

function same(a: JsonValue, b: JsonValue): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

export function fieldText(type: TokenType | undefined, written: JsonValue | undefined): string {
    if (written === undefined) return "";
    const field = fieldFor(type, written);
    switch (field.kind) {
        case "dimension":
        case "duration":
            return `${field.value}${field.unit}`;
        case "number":
            return String(field.value);
        default:
            return JSON.stringify(writtenFor(field));
    }
}
