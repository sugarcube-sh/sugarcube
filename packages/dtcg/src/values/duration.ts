import type { JsonPath, ParseOptions, ParseResult, UnresolvedValue } from "../index.js";
import { durationUnits } from "./units.js";
import { readMeasure } from "./measure.js";

export function readDuration(
    raw: unknown,
    at: JsonPath,
    options?: ParseOptions,
): ParseResult<UnresolvedValue<"duration">> {
    return readMeasure("duration", durationUnits, raw, at, options);
}
