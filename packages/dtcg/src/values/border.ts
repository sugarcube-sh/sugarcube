import type { JsonPath, ParseResult, WithAliases } from "../index.js";
import { readColor } from "./color.js";
import { readComposite } from "./composite.js";
import { readDimension } from "./dimension.js";
import { readStrokeStyle } from "./stroke-style.js";

const PARTS = { color: readColor, width: readDimension, style: readStrokeStyle };

export function readBorder(raw: unknown, at: JsonPath): ParseResult<WithAliases<"border">> {
    return readComposite("border", PARTS, raw, at);
}
