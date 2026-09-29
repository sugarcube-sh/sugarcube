import type { JsonPath, ParseResult, WithAliases } from "../index.js";
import { dimensionUnits } from "./units.js";
import { readMeasure } from "./measure.js";

export function readDimension(raw: unknown, at: JsonPath): ParseResult<WithAliases<"dimension">> {
    return readMeasure("dimension", dimensionUnits, raw, at);
}
