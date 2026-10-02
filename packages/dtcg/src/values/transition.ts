import type { JsonPath, ParseOptions, ParseResult, UnresolvedValue } from "../index.js";
import { type ObjectForm, type PartReaders, readComposite } from "./composite.js";
import { readCubicBezier } from "./cubic-bezier.js";
import { readDuration } from "./duration.js";

const PARTS: PartReaders<ObjectForm<"transition">> = {
    duration: readDuration,
    delay: readDuration,
    timingFunction: readCubicBezier,
};

export function readTransition(
    raw: unknown,
    at: JsonPath,
    options?: ParseOptions,
): ParseResult<UnresolvedValue<"transition">> {
    return readComposite("transition", PARTS, raw, at, options);
}
