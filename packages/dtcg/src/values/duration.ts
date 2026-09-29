import type { JsonPath, ParseResult, WithAliases } from "../index.js";
import { durationUnits } from "./units.js";
import { readMeasure } from "./measure.js";

export function readDuration(raw: unknown, at: JsonPath): ParseResult<WithAliases<"duration">> {
    return readMeasure("duration", durationUnits, raw, at);
}
