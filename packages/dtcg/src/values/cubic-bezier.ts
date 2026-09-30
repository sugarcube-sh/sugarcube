import type { JsonPath, ParseResult, Pointer, ValueError, UnresolvedValue } from "../index.js";
import { readAlias, readPointer } from "./references.js";
import { valueError } from "./value-errors.js";

type Coordinate = number | Pointer;

const X_POSITIONS = new Set([0, 2]);

export function readCubicBezier(
    raw: unknown,
    at: JsonPath,
): ParseResult<UnresolvedValue<"cubicBezier">> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference };

    if (!Array.isArray(raw)) {
        return { ok: false, errors: [valueError(at, "wrong-shape", "cubicBezier")] };
    }

    if (raw.length !== 4) {
        return { ok: false, errors: [valueError(at, "not-four-numbers")] };
    }

    const errors: ValueError[] = [];
    const coordinates = raw.map((coordinate: unknown, index): Coordinate => {
        const pointer = readPointer(coordinate);
        if (pointer) return pointer;
        if (readAlias(coordinate)) {
            errors.push(valueError([...at, index], "alias-not-allowed-here", coordinate as string));
            return 0;
        }

        if (typeof coordinate !== "number" || !Number.isFinite(coordinate)) {
            errors.push(valueError([...at, index], "not-a-number", coordinate));
            return 0;
        }

        if (X_POSITIONS.has(index) && (coordinate < 0 || coordinate > 1)) {
            errors.push(valueError([...at, index], "x-out-of-range", coordinate));
        }
        return coordinate;
    });

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, value: coordinates as [Coordinate, Coordinate, Coordinate, Coordinate] };
}
