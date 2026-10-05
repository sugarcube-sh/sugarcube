import type { JsonPath, ParseResult, Pointer, ValueError, UnresolvedValue } from "../index.js";
import { readAlias, readPointer } from "./references.js";
import { refusedAlias } from "./refuse-alias.js";
import { valueError } from "./value-errors.js";

type Coordinate = number | Pointer;

const type = "cubicBezier";

const X_COORDINATES = new Map([
    [0, "x1"],
    [2, "x2"],
] as const);

export function readCubicBezier(
    raw: unknown,
    at: JsonPath,
): ParseResult<UnresolvedValue<"cubicBezier">> {
    const reference = readAlias(raw) ?? readPointer(raw);
    if (reference) return { ok: true, value: reference, ignored: [] };

    if (!Array.isArray(raw)) {
        return {
            ok: false,
            errors: [valueError(at, { type, reason: "wrong-shape", value: raw })],
            ignored: [],
        };
    }

    if (raw.length !== 4) {
        return {
            ok: false,
            errors: [valueError(at, { type, reason: "not-four-numbers", count: raw.length })],
            ignored: [],
        };
    }

    const errors: ValueError[] = [];
    const coordinates = raw.map((coordinate: unknown, index): Coordinate => {
        const pointer = readPointer(coordinate);
        if (pointer) return pointer;
        if (refusedAlias(coordinate, [...at, index], type, errors)) return 0;

        if (typeof coordinate !== "number" || !Number.isFinite(coordinate)) {
            errors.push(
                valueError([...at, index], { type, reason: "not-a-number", value: coordinate }),
            );
            return 0;
        }

        const x = X_COORDINATES.get(index as 0 | 2);
        if (x && (coordinate < 0 || coordinate > 1)) {
            errors.push(
                valueError([...at, index], {
                    type,
                    reason: "x-out-of-range",
                    value: coordinate,
                    coordinate: x,
                }),
            );
        }
        return coordinate;
    });

    if (errors.length > 0) return { ok: false, errors, ignored: [] };
    return {
        ok: true,
        value: coordinates as [Coordinate, Coordinate, Coordinate, Coordinate],
        ignored: [],
    };
}
