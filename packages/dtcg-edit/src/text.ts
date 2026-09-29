import type { JsonPath } from "@sugarcube-sh/dtcg";
import type { Json } from "./index.js";

/** Sets a value in JSON text, changing nothing else. */
export function setAt(text: string, path: JsonPath, value: Json): string {
    throw new Error("not implemented yet");
}
/** Removes a value from JSON text, changing nothing else. */
export function removeAt(text: string, path: JsonPath): string {
    throw new Error("not implemented yet");
}
/** Renames a key in JSON text, keeping its value and position. */
export function renameKeyAt(text: string, path: JsonPath, name: string): string {
    throw new Error("not implemented yet");
}
/** Moves a key to a new position among its siblings. */
export function reorderKeyAt(text: string, path: JsonPath, index: number): string {
    throw new Error("not implemented yet");
}
/** The value at a path in JSON text. */
export function nodeAt(text: string, path: JsonPath): unknown {
    throw new Error("not implemented yet");
}
