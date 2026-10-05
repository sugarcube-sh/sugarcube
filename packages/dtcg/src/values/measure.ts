import type {
    JsonPath,
    ParseOptions,
    ParseResult,
    Pointer,
    ValueError,
    UnresolvedValue,
} from "../index.js";
import { isJsonObject } from "./json.js";
import { readAlias, readPointer } from "./references.js";
import { unknownProperties } from "./unknown-properties.js";
import { valueError } from "./value-errors.js";

type MeasureType = "dimension" | "duration";

const PROPERTIES = new Set(["value", "unit"]);

/**
 * A number followed by a unit, such as `"16px"` or `"200ms"`: how earlier drafts of the spec wrote
 * dimensions and durations. It is always an error. Recognising one lets the error say so, and `read`
 * offer the object as a fix.
 */
export const STRING_WITH_UNIT = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]+)$/i;

export function readMeasure<T extends MeasureType>(
    type: T,
    units: readonly string[],
    raw: unknown,
    at: JsonPath,
    options: ParseOptions | undefined,
): ParseResult<UnresolvedValue<T>> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference as UnresolvedValue<T>, ignored: [] };

    if (typeof raw === "string") {
        if (STRING_WITH_UNIT.test(raw)) {
            return {
                ok: false,
                errors: [valueError(at, { type, reason: "string-with-unit", value: raw })],
                ignored: [],
            };
        }
    }

    if (!isJsonObject(raw)) {
        return {
            ok: false,
            errors: [valueError(at, { type, reason: "wrong-shape", value: raw })],
            ignored: [],
        };
    }

    const errors: ValueError[] = [];
    const ignored = unknownProperties(
        raw,
        (name) => PROPERTIES.has(name),
        type,
        at,
        errors,
        options,
    );

    const value = readAmount(raw, at, type, errors);
    const unit = readUnit(raw, at, type, units, errors);

    if (errors.length > 0 || value === undefined || unit === undefined) {
        return { ok: false, errors, ignored };
    }
    return { ok: true, value: { value, unit } as UnresolvedValue<T>, ignored };
}

function readAmount(
    raw: Record<string, unknown>,
    at: JsonPath,
    type: MeasureType,
    errors: ValueError[],
): number | Pointer | undefined {
    if (!("value" in raw)) {
        errors.push(
            valueError([...at, "value"], { type, reason: "missing-property", property: "value" }),
        );
        return undefined;
    }

    const pointer = readPointer(raw.value);
    if (pointer) return pointer;
    if (readAlias(raw.value)) {
        errors.push(
            valueError([...at, "value"], {
                type,
                reason: "alias-not-allowed-here",
                reference: raw.value as string,
            }),
        );
        return undefined;
    }

    if (typeof raw.value === "number" && Number.isFinite(raw.value)) return raw.value;
    errors.push(valueError([...at, "value"], { type, reason: "not-a-number", value: raw.value }));
    return undefined;
}

function readUnit(
    raw: Record<string, unknown>,
    at: JsonPath,
    type: MeasureType,
    units: readonly string[],
    errors: ValueError[],
): string | Pointer | undefined {
    if (!("unit" in raw)) {
        errors.push(
            valueError([...at, "unit"], { type, reason: "missing-property", property: "unit" }),
        );
        return undefined;
    }

    const pointer = readPointer(raw.unit);
    if (pointer) return pointer;
    if (readAlias(raw.unit)) {
        errors.push(
            valueError([...at, "unit"], {
                type,
                reason: "alias-not-allowed-here",
                reference: raw.unit as string,
            }),
        );
        return undefined;
    }

    if (typeof raw.unit === "string" && units.includes(raw.unit)) return raw.unit;
    errors.push(
        valueError([...at, "unit"], {
            type,
            reason: "unit-not-allowed",
            unit: raw.unit,
            allowed: units,
        }),
    );
    return undefined;
}
