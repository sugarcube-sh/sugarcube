import type { JsonPath, ParseResult, UnresolvedValue } from "../index.js";
import { durationUnits } from "./units.js";
import { readMeasure } from "./measure.js";

export function readDuration(raw: unknown, at: JsonPath): ParseResult<UnresolvedValue<"duration">> {
    return readMeasure("duration", durationUnits, raw, at);
}
