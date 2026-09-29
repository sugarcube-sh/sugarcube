import type { JsonPath, ParseResult, Pointer, ValueError, WithAliases } from "../index.js";
import { isPlainObject, readAlias, readPointer } from "./references.js";
import { valueError } from "./value-errors.js";

type MeasureType = "dimension" | "duration";

const PROPERTIES = new Set(["value", "unit"]);

/**
 * A number followed by a unit, such as `"16px"` or `"200ms"`: how earlier drafts of the spec wrote
 * dimensions and durations. It is always an error. Recognising one lets the error say so, and show
 * the object to write instead.
 */
const STRING_WITH_UNIT = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]+)$/i;

export function readMeasure<T extends MeasureType>(
    type: T,
    units: readonly string[],
    raw: unknown,
    at: JsonPath,
): ParseResult<WithAliases<T>> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference as WithAliases<T> };

    if (typeof raw === "string") {
        const match = STRING_WITH_UNIT.exec(raw);
        if (match) {
            const [, number, unit] = match;
            const example = JSON.stringify({
                value: Number(number),
                unit: units.includes(unit!) ? unit : units[0],
            });
            return { ok: false, errors: [valueError(at, "string-with-unit", raw, example)] };
        }
    }

    if (!isPlainObject(raw)) {
        return { ok: false, errors: [valueError(at, "wrong-shape", type)] };
    }

    const errors: ValueError[] = [];
    for (const name of Object.keys(raw)) {
        if (!PROPERTIES.has(name)) {
            errors.push(valueError([...at, name], "unknown-property", name, type));
        }
    }

    const value = readAmount(raw, at, type, errors);
    const unit = readUnit(raw, at, type, units, errors);

    if (errors.length > 0 || value === undefined || unit === undefined) {
        return { ok: false, errors };
    }
    return { ok: true, value: { value, unit } as WithAliases<T> };
}

function readAmount(
    raw: Record<string, unknown>,
    at: JsonPath,
    type: MeasureType,
    errors: ValueError[],
): number | Pointer | undefined {
    if (!("value" in raw)) {
        errors.push(valueError(at, "missing-property", "value", type));
        return undefined;
    }

    const pointer = readPointer(raw.value);
    if (pointer) return pointer;
    if (readAlias(raw.value)) {
        errors.push(valueError([...at, "value"], "alias-not-allowed-here", raw.value as string));
        return undefined;
    }

    if (typeof raw.value === "number" && Number.isFinite(raw.value)) return raw.value;
    errors.push(valueError([...at, "value"], "not-a-number", raw.value));
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
        errors.push(valueError(at, "missing-property", "unit", type));
        return undefined;
    }

    const pointer = readPointer(raw.unit);
    if (pointer) return pointer;
    if (readAlias(raw.unit)) {
        errors.push(valueError([...at, "unit"], "alias-not-allowed-here", raw.unit as string));
        return undefined;
    }

    if (typeof raw.unit === "string" && units.includes(raw.unit)) return raw.unit;
    errors.push(valueError([...at, "unit"], "unit-not-allowed", raw.unit, units));
    return undefined;
}
