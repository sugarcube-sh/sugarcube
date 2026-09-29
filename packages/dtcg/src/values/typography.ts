import type { JsonPath, ParseResult, WithAliases } from "../index.js";
import { type ObjectForm, type PartReaders, readComposite } from "./composite.js";
import { readDimension } from "./dimension.js";
import { readFontFamily } from "./font-family.js";
import { readFontWeight } from "./font-weight.js";
import { readNumber } from "./number.js";

const PARTS: PartReaders<ObjectForm<"typography">> = {
    fontFamily: readFontFamily,
    fontSize: readDimension,
    fontWeight: readFontWeight,
    letterSpacing: readDimension,
    lineHeight: readNumber,
};

export function readTypography(raw: unknown, at: JsonPath): ParseResult<WithAliases<"typography">> {
    return readComposite("typography", PARTS, raw, at);
}
