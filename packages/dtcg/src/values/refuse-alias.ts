import type { JsonPath, TokenType, ValueError } from "../index.js";
import { readAlias } from "./references.js";
import { valueError } from "./value-errors.js";

export function refusedAlias(
    raw: unknown,
    at: JsonPath,
    type: TokenType,
    errors: ValueError[],
): boolean {
    if (typeof raw !== "string" || !readAlias(raw)) return false;
    errors.push(valueError(at, { type, reason: "alias-not-allowed-here", reference: raw }));
    return true;
}
