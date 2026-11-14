import type { JsonPath } from "@sugarcube-sh/dtcg";
import { exceptionMessages } from "./error-messages.js";

export { removeAt, renameKeyAt, setAt } from "./text-edits.js";

/**
 * Moves a key to a new position among its siblings.
 *
 * @param text - The JSON text, such as a token file's.
 * @param jsonPath - The key, such as `["color", "primary"]`.
 * @param index - Its new position, from `0`.
 */
export function reorderKeyAt(text: string, jsonPath: JsonPath, index: number): string {
    throw new Error(exceptionMessages.notImplemented);
}
