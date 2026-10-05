import type { JsonPath, ParseOptions, ParseResult, UnresolvedValue } from "../index.js";
import { dimensionUnits } from "./units.js";
import { readMeasure } from "./measure.js";

export function readDimension(
    raw: unknown,
    at: JsonPath,
    options?: ParseOptions,
): ParseResult<UnresolvedValue<"dimension">> {
    return readMeasure("dimension", dimensionUnits, raw, at, options);
}
