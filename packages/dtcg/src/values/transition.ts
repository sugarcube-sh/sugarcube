import type { JsonPath, ParseResult, UnresolvedValue } from "../index.js";
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
): ParseResult<UnresolvedValue<"transition">> {
    return readComposite("transition", PARTS, raw, at);
}
