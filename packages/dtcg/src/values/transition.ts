import type { JsonPath, ParseResult, WithAliases } from "../index.js";
import { type PartReaders, readComposite } from "./composite.js";
import { readCubicBezier } from "./cubic-bezier.js";
import { readDuration } from "./duration.js";

const PARTS: PartReaders<"transition"> = {
    duration: readDuration,
    delay: readDuration,
    timingFunction: readCubicBezier,
};

export function readTransition(raw: unknown, at: JsonPath): ParseResult<WithAliases<"transition">> {
    return readComposite<"transition">("transition", PARTS, raw, at);
}
