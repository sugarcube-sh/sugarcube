import type { JsonPath, ParseResult, WithAliases } from "../index.js";
import { readComposite } from "./composite.js";
import { readCubicBezier } from "./cubic-bezier.js";
import { readDuration } from "./duration.js";

const PARTS = { duration: readDuration, delay: readDuration, timingFunction: readCubicBezier };

export function readTransition(raw: unknown, at: JsonPath): ParseResult<WithAliases<"transition">> {
    return readComposite("transition", PARTS, raw, at);
}
