import {
    type CubicBezierValue,
    type DimensionValue,
    type DurationValue,
    type JsonValue,
    type StrokeStyleKeyword,
    type TokenType,
    isEqualJson,
} from "@sugarcube-sh/dtcg";
import {
    type FontWeightKeyword,
    dimensionUnits,
    durationUnits,
    fontWeightKeywords,
    parseValue,
    parseReference,
    strokeStyleKeywords,
} from "@sugarcube-sh/dtcg/values";
import {
    type ColorDraft,
    type ColorField,
    toColorDraft,
    parseColorField,
    parseColorDraft,
} from "./color";
import {
    type FieldWithParts,
    parseCompositeField,
    parseDashesField,
    isComposite,
    toCompositeValue,
} from "./parts";
import { parseNumber } from "./typed-text";

export type Field =
    | { readonly kind: "dimension"; readonly value: number; readonly unit: DimensionValue["unit"] }
    | { readonly kind: "duration"; readonly value: number; readonly unit: DurationValue["unit"] }
    | { readonly kind: "number"; readonly value: number }
    | { readonly kind: "fontWeight"; readonly value: number | FontWeightKeyword }
    | { readonly kind: "fontFamily"; readonly fonts: readonly string[]; readonly single: boolean }
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
    | { readonly kind: "fontFamily"; readonly fonts: readonly string[]; readonly single: boolean }
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

export function parseField(type: TokenType | undefined, value: JsonValue): Field {
    const json: Field = { kind: "json", value };
    if (type === undefined) return json;
    const reference = parseReference(value);
    if (reference) {
        return reference.syntax === "curly-brace"
            ? { kind: "reference", path: reference.path }
            : json;
    }
    if (isComposite(type)) return parseCompositeField(type, value) ?? json;
    if (type === "strokeStyle") {
        const dashes = parseDashesField(value);
        if (dashes) return dashes;
    }
    if (!hasField(type)) return json;
    return parseLiteralField(type, value) ?? json;
}

function parseLiteralField(type: FieldType, value: JsonValue): Field | undefined {
    switch (type) {
        case "dimension": {
            const parsed = parseValue(type, value, { references: false });
            return parsed.ok
                ? { kind: type, value: parsed.value.value, unit: parsed.value.unit }
                : undefined;
        }
        case "duration": {
            const parsed = parseValue(type, value, { references: false });
            return parsed.ok
                ? { kind: type, value: parsed.value.value, unit: parsed.value.unit }
                : undefined;
        }
        case "number": {
            const parsed = parseValue(type, value, { references: false });
            return parsed.ok ? { kind: type, value: parsed.value } : undefined;
        }
        case "fontWeight": {
            const parsed = parseValue(type, value, { references: false });
            if (!parsed.ok) return undefined;
            const keyword = weightKeywords.find((each) => each === value);
            return { kind: type, value: keyword ?? parsed.value };
        }
        case "fontFamily": {
            const parsed = parseValue(type, value, { references: false });
            return parsed.ok
                ? { kind: type, fonts: parsed.value, single: typeof value === "string" }
                : undefined;
        }
        case "cubicBezier": {
            const parsed = parseValue(type, value, { references: false });
            return parsed.ok ? { kind: type, points: parsed.value } : undefined;
        }
        case "strokeStyle": {
            const parsed = parseValue(type, value, { references: false });
            return parsed.ok && typeof parsed.value === "string"
                ? { kind: type, keyword: parsed.value }
                : undefined;
        }
        case "color":
            return parseColorField(value);
    }
}

export function toJsonValue(field: Field): JsonValue {
    switch (field.kind) {
        case "dimension":
        case "duration":
            return { value: field.value, unit: field.unit };
        case "number":
        case "fontWeight":
            return field.value;
        case "fontFamily": {
            const [only] = field.fonts;
            return field.single && field.fonts.length === 1 && only !== undefined
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
            return field.value;
        case "parts":
        case "list":
        case "dashes":
            return toCompositeValue(field);
        case "json":
            return field.value;
    }
}

export function isChanged(field: Field, value: JsonValue | undefined): boolean {
    return value === undefined || !isEqualJson(toJsonValue(field), value);
}

export function toDraft(type: FieldType, field: Field | undefined): Draft {
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
                ? { kind: type, fonts: field.fonts, single: field.single }
                : { kind: type, fonts: [""], single: true };
        case "cubicBezier": {
            if (field?.kind !== type) return { kind: type, points: ["", "", "", ""] };
            const [a, b, c, d] = field.points;
            return { kind: type, points: [String(a), String(b), String(c), String(d)] };
        }
        case "strokeStyle":
            return { kind: type, keyword: field?.kind === type ? field.keyword : "" };
        case "color":
            return toColorDraft(field?.kind === type ? field : undefined);
    }
}

export function parseDraft(draft: Draft): Field | undefined {
    switch (draft.kind) {
        case "dimension": {
            const value = parseNumber(draft.amount);
            const unit = dimensionUnits.find((each) => each === draft.unit);
            return value === undefined || unit === undefined
                ? undefined
                : { kind: draft.kind, value, unit };
        }
        case "duration": {
            const value = parseNumber(draft.amount);
            const unit = durationUnits.find((each) => each === draft.unit);
            return value === undefined || unit === undefined
                ? undefined
                : { kind: draft.kind, value, unit };
        }
        case "number": {
            const value = parseNumber(draft.amount);
            return value === undefined ? undefined : { kind: draft.kind, value };
        }
        case "fontWeight": {
            if (draft.choice === "") return undefined;
            if (draft.choice !== "number") return { kind: draft.kind, value: draft.choice };
            const value = parseNumber(draft.amount);
            return value === undefined ? undefined : { kind: draft.kind, value };
        }
        case "fontFamily":
            return draft.fonts.length > 0 && draft.fonts.every((name) => name !== "")
                ? { kind: draft.kind, fonts: draft.fonts, single: draft.single }
                : undefined;
        case "cubicBezier": {
            const [a, b, c, d] = draft.points.map(parseNumber);
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
            return parseColorDraft(draft);
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

export function isSameValue(draft: Draft, field: Field | undefined): boolean {
    const draftField = parseDraft(draft);
    return draftField === undefined || field === undefined
        ? draftField === field
        : isEqualJson(toJsonValue(draftField), toJsonValue(field));
}

export function formatValue(type: TokenType | undefined, value: JsonValue | undefined): string {
    if (value === undefined) return "";
    const field = parseField(type, value);
    switch (field.kind) {
        case "dimension":
        case "duration":
            return `${field.value}${field.unit}`;
        case "number":
            return String(field.value);
        default:
            return JSON.stringify(toJsonValue(field));
    }
}
