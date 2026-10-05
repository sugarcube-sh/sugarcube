import type {
    IgnoredProperty,
    UnresolvedStrokeStyle,
    JsonPath,
    ParseResult,
    Pointer,
    ValueError,
} from "../index.js";
import { readDimension } from "./dimension.js";
import { type LineCap, lineCaps, strokeStyleKeywords } from "./keywords.js";
import { isJsonObject } from "./json.js";
import { readAlias, readPointer } from "./references.js";
import { setAside } from "./set-aside.js";
import { valueError } from "./value-errors.js";

type Keyword = (typeof strokeStyleKeywords)[number];
type DashArray = Extract<UnresolvedStrokeStyle, { kind: "dash" }>["dashArray"];

const PROPERTIES = new Set(["dashArray", "lineCap"]);

const type = "strokeStyle";

export function readStrokeStyle(raw: unknown, at: JsonPath): ParseResult<UnresolvedStrokeStyle> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference, ignored: [] };

    if (typeof raw === "string") {
        if (strokeStyleKeywords.includes(raw as Keyword)) {
            return { ok: true, value: { kind: "keyword", keyword: raw as Keyword }, ignored: [] };
        }
        return {
            ok: false,
            errors: [
                valueError(at, {
                    type,
                    reason: "unknown-stroke-style-keyword",
                    value: raw,
                    keywords: strokeStyleKeywords,
                }),
            ],
            ignored: [],
        };
    }

    if (!isJsonObject(raw)) {
        return {
            ok: false,
            errors: [valueError(at, { type, reason: "wrong-shape", value: raw })],
            ignored: [],
        };
    }

    const errors: ValueError[] = [];
    const ignored = setAside(raw, (name) => PROPERTIES.has(name), type, at, errors);

    const dashArray = readDashArray(raw, at, errors, ignored);
    const lineCap = readLineCap(raw, at, errors);

    if (errors.length > 0 || dashArray === undefined || lineCap === undefined) {
        return { ok: false, errors, ignored };
    }
    return { ok: true, value: { kind: "dash", dashArray, lineCap }, ignored };
}

function readDashArray(
    raw: Record<string, unknown>,
    at: JsonPath,
    errors: ValueError[],
    ignored: IgnoredProperty[],
): DashArray | undefined {
    if (!("dashArray" in raw)) {
        errors.push(
            valueError([...at, "dashArray"], {
                type,
                reason: "missing-property",
                property: "dashArray",
            }),
        );
        return undefined;
    }

    const pointer = readPointer(raw.dashArray);
    if (pointer) return pointer;

    const path = [...at, "dashArray"];
    if (!Array.isArray(raw.dashArray)) {
        errors.push(
            valueError(path, { type, reason: "dash-array-not-a-list", value: raw.dashArray }),
        );
        return undefined;
    }
    if (raw.dashArray.length === 0) {
        errors.push(valueError(path, { type, reason: "empty-dash-array" }));
        return undefined;
    }

    const before = errors.length;
    const lengths = raw.dashArray.map((length: unknown, index) => {
        const result = readDimension(length, [...path, index]);
        ignored.push(...result.ignored);
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
        errors.push(
            valueError([...at, "lineCap"], {
                type,
                reason: "missing-property",
                property: "lineCap",
            }),
        );
        return undefined;
    }

    const pointer = readPointer(raw.lineCap);
    if (pointer) return pointer;

    if (lineCaps.includes(raw.lineCap as LineCap)) return raw.lineCap as LineCap;
    errors.push(
        valueError([...at, "lineCap"], {
            type,
            reason: "unknown-line-cap",
            value: raw.lineCap,
            lineCaps,
        }),
    );
    return undefined;
}
