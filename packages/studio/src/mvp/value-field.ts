import { STROKE_STYLE_KEYWORDS } from "@sugarcube-sh/core/client";
import { readColorShape, readLiteralColor, writeColor } from "../tokens/color-shape";
import { readCubicBezier, writeCubicBezier } from "../tokens/cubic-bezier";
import { isDimension } from "../tokens/dimension";
import { readFontFamily, writeFontFamily } from "../tokens/font-family";
import { fontWeightOptions, readFontWeight, writeFontWeight } from "../tokens/font-weight";
import { readStrokeStyle } from "../tokens/stroke-style";
import {
    type CompositeField,
    compositeFields,
    compositePart,
    compositeTypes,
    emptyComposite,
    emptyLayers,
    layerFields,
    layerNoun,
    readLayers,
} from "./composite";

export type ValueChoice = {
    value: string;
    label: string;
};

export type ValueField = {
    text: string;
    /** False where a text box would lose information, so the cell reads only. */
    editable: boolean;
    choices?: ValueChoice[];
};

const EMPTY: ValueField = { text: "", editable: false };

/**
 * Dispatch is on `$type` rather than the JS shape, so a token keeps the form it
 * was authored in: a hex colour stays hex, a one-string font stack does not
 * become an array. A reference falls through to the plain string branch.
 */
export function readField(type: string | undefined, value: unknown): ValueField {
    if (value === undefined || value === null) return EMPTY;

    if (type === "color") {
        const color = readLiteralColor(value);
        if (color) return { text: color.css, editable: true };
    }

    if (type === "fontFamily") {
        const family = readFontFamily(value);
        if (family) return { text: family.text, editable: true };
    }

    if (type === "cubicBezier") {
        const curve = readCubicBezier(value);
        if (curve) return { text: curve.join(", "), editable: true };
    }

    if (type === "fontWeight") {
        const weight = readFontWeight(value);
        if (weight) {
            return {
                text: String(weight.weight),
                editable: true,
                choices: fontWeightOptions(weight.weight).map((option) => ({
                    value: option.value,
                    label: option.label,
                })),
            };
        }
    }

    if (type === "strokeStyle") {
        const keyword = readStrokeStyle(value);
        if (keyword) {
            return {
                text: keyword,
                editable: true,
                choices: STROKE_STYLE_KEYWORDS.map((word) => ({ value: word, label: word })),
            };
        }
    }

    if (typeof value === "string") return { text: value, editable: true };
    if (typeof value === "number") return { text: String(value), editable: true };
    if (isDimension(value)) return { text: `${value.value}${value.unit}`, editable: true };

    const layers = readLayers(type, value);
    if (layers) {
        const text =
            layers.length === 1
                ? summarise(layerFields(type), layers[0])
                : `${layers.length} ${layerNoun(type, layers.length)}`;
        return { text, editable: false };
    }

    if (Array.isArray(value)) return { text: value.map(describe).join(", "), editable: false };

    const parts = compositeFields(type, value);
    if (parts.length > 0) return { text: summarise(parts, value), editable: false };

    return { text: JSON.stringify(value), editable: false };
}

const DIMENSION = /^(-?\d+(?:\.\d+)?)\s*([a-z%]+)$/i;

/** `undefined` rejects the text, leaving the stored value alone. */
export function writeField(type: string | undefined, previous: unknown, text: string): unknown {
    if (type === "color") {
        const shape = readColorShape(previous);
        if (shape) return writeColor(shape, text.trim());
    }

    if (type === "fontFamily") {
        const family = readFontFamily(previous);
        if (family) return writeFontFamily(text, family.list);
    }

    if (type === "cubicBezier" && readCubicBezier(previous)) {
        return writeCubicBezier(text);
    }

    if (type === "fontWeight") {
        const weight = readFontWeight(previous);
        if (weight) return writeFontWeight(weight.shape, Number(text));
    }

    if (typeof previous === "string") return text;

    if (typeof previous === "number") {
        const parsed = Number(text.trim());
        return text.trim().length > 0 && Number.isFinite(parsed) ? parsed : undefined;
    }

    if (isDimension(previous)) {
        const match = DIMENSION.exec(text.trim());
        if (!match?.[1] || !match[2]) return undefined;
        return { value: Number(match[1]), unit: match[2] };
    }

    return undefined;
}

function describe(value: unknown): string {
    return typeof value === "string" ? value : JSON.stringify(value);
}

function summarise(parts: CompositeField[], value: unknown): string {
    return parts
        .map((part) => readField(part.type, compositePart(value, part.key)).text)
        .filter(Boolean)
        .join(" ");
}

const EMPTY_BY_TYPE: Record<string, unknown> = {
    color: "",
    dimension: { value: 0, unit: "px" },
    fluidDimension: { min: { value: 0, unit: "px" }, max: { value: 0, unit: "px" } },
    duration: { value: 0, unit: "ms" },
    cubicBezier: [0, 0, 1, 1],
    fontFamily: "",
    fontWeight: 400,
    number: 0,
    strokeStyle: "solid",
};

/** The types a new token can be: every simple type with an empty here, then the composites. */
export const DTCG_TYPES: readonly string[] = [...Object.keys(EMPTY_BY_TYPE), ...compositeTypes()];

/** What a new token of this type holds before anyone edits it: a value `readField` can show and `writeField` can grow. */
export function emptyValueFor(type: string | undefined): unknown {
    if (type === undefined) return "";
    if (type in EMPTY_BY_TYPE) return EMPTY_BY_TYPE[type];
    const layered = emptyLayers(type);
    if (layered) return layered.length === 1 ? layered[0] : layered;
    return emptyComposite(type) ?? "";
}
