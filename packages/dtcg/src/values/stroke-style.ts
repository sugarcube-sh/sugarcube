import type { AliasedStrokeStyle, JsonPath, ParseResult, Pointer, ValueError } from "../index.js";
import { readDimension } from "./dimension.js";
import { type LineCap, lineCaps, strokeStyleKeywords } from "./keywords.js";
import { isPlainObject, readAlias, readPointer } from "./references.js";
import { valueError } from "./value-errors.js";

type Keyword = (typeof strokeStyleKeywords)[number];
type DashArray = Extract<AliasedStrokeStyle, { kind: "dash" }>["dashArray"];

const PROPERTIES = new Set(["dashArray", "lineCap"]);

export function readStrokeStyle(raw: unknown, at: JsonPath): ParseResult<AliasedStrokeStyle> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference };

    if (typeof raw === "string") {
        if (strokeStyleKeywords.includes(raw as Keyword)) {
            return { ok: true, value: { kind: "keyword", keyword: raw as Keyword } };
        }
        return {
            ok: false,
            errors: [valueError(at, "unknown-stroke-style-keyword", raw, strokeStyleKeywords)],
        };
    }

    if (!isPlainObject(raw)) {
        return { ok: false, errors: [valueError(at, "wrong-shape", "strokeStyle")] };
    }

    const errors: ValueError[] = [];
    for (const name of Object.keys(raw)) {
        if (!PROPERTIES.has(name)) {
            errors.push(valueError([...at, name], "unknown-property", name, "strokeStyle"));
        }
    }

    const dashArray = readDashArray(raw, at, errors);
    const lineCap = readLineCap(raw, at, errors);

    if (errors.length > 0 || dashArray === undefined || lineCap === undefined) {
        return { ok: false, errors };
    }
    return { ok: true, value: { kind: "dash", dashArray, lineCap } };
}

function readDashArray(
    raw: Record<string, unknown>,
    at: JsonPath,
    errors: ValueError[],
): DashArray | undefined {
    if (!("dashArray" in raw)) {
        errors.push(valueError(at, "missing-property", "dashArray", "strokeStyle"));
        return undefined;
    }

    const pointer = readPointer(raw.dashArray);
    if (pointer) return pointer;

    const path = [...at, "dashArray"];
    if (!Array.isArray(raw.dashArray)) {
        errors.push(valueError(path, "dash-array-not-a-list"));
        return undefined;
    }
    if (raw.dashArray.length === 0) {
        errors.push(valueError(path, "empty-dash-array"));
        return undefined;
    }

    const before = errors.length;
    const lengths = raw.dashArray.map((length: unknown, index) => {
        const result = readDimension(length, [...path, index]);
        if (!result.ok) {
            errors.push(...result.errors);
            return undefined;
        }
        return result.value;
    });

    if (errors.length > before) return undefined;
    return lengths as DashArray;
}

function readLineCap(
    raw: Record<string, unknown>,
    at: JsonPath,
    errors: ValueError[],
): LineCap | Pointer | undefined {
    if (!("lineCap" in raw)) {
        errors.push(valueError(at, "missing-property", "lineCap", "strokeStyle"));
        return undefined;
    }

    const pointer = readPointer(raw.lineCap);
    if (pointer) return pointer;

    if (lineCaps.includes(raw.lineCap as LineCap)) return raw.lineCap as LineCap;
    errors.push(valueError([...at, "lineCap"], "unknown-line-cap", raw.lineCap, lineCaps));
    return undefined;
}
