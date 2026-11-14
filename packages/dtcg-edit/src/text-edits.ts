import type { JsonPath, JsonValue } from "@sugarcube-sh/dtcg";
import { type Node, findNodeAtLocation, getNodeValue, parseTree } from "jsonc-parser";
import {
    type Splice,
    getInsertionSplices,
    getRemovalSplices,
    getReplacementSplice,
    applySplices,
} from "./json-text.js";

/**
 * Sets a value in JSON text without changing anything else.
 *
 * Missing groups on the way are made. A new member follows the style of the one before it.
 *
 * @param text - The JSON text, such as a token file's.
 * @param jsonPath - Where the value goes, such as `["color", "primary", "$value"]`.
 * @param value - The value to write, such as `"{color.blue.300}"`.
 * @returns The new text, or `undefined` when `jsonPath` goes through something that isn't a
 *   group, or past the end of an array.
 *
 * @example
 * setAt('{ "color": { "primary": { "$value": "{color.blue.500}" } } }', ["color", "primary", "$value"], "{color.blue.300}")
 * // => '{ "color": { "primary": { "$value": "{color.blue.300}" } } }'
 */
export function setAt(text: string, jsonPath: JsonPath, value: JsonValue): string | undefined {
    const root = parseTree(text);
    const splices = root && getSetSplices(text, root, jsonPath, value);
    return splices && applySplices(text, splices);
}

export function getSetSplices(
    text: string,
    root: Node,
    jsonPath: JsonPath,
    value: JsonValue,
): Splice[] | undefined {
    let node = root;
    for (const [index, step] of jsonPath.entries()) {
        const child = findNodeAtLocation(node, [step]);
        if (child) {
            node = child;
            continue;
        }
        const missing = jsonPath.slice(index);
        if (node.type !== "object" || missing.some((each) => typeof each !== "string")) {
            return undefined;
        }
        const [key, ...inner] = missing as string[];
        const nested = inner.reduceRight<JsonValue>((acc, each) => ({ [each]: acc }), value);
        return getInsertionSplices(text, node, key as string, nested);
    }
    return [getReplacementSplice(text, node, value)];
}

/**
 * Removes a value from JSON text without changing anything else.
 *
 * A member on its own lines goes with its lines. A group left empty is written `{}`.
 *
 * @param text - The JSON text, such as a token file's.
 * @param jsonPath - The value to remove, such as `["color", "secondary"]`.
 * @returns The new text, or the same text when nothing is at `jsonPath`.
 *
 * @example
 * removeAt('{ "color": { "primary": {}, "secondary": {} } }', ["color", "secondary"])
 * // => '{ "color": { "primary": {} } }'
 */
export function removeAt(text: string, jsonPath: JsonPath): string {
    const node = findNodeInText(text, jsonPath);
    return node ? applySplices(text, getRemovalSplices(text, node)) : text;
}

/**
 * Renames a key in JSON text without moving it or changing its value.
 *
 * @param text - The JSON text, such as a token file's.
 * @param jsonPath - The key, such as `["color", "primary"]`.
 * @param name - The new name, such as `"brand"`.
 * @returns The new text, or `undefined` when nothing is at `jsonPath` or a sibling has the name.
 *
 * @example
 * renameKeyAt('{ "color": { "primary": {} } }', ["color", "primary"], "brand")
 * // => '{ "color": { "brand": {} } }'
 */
export function renameKeyAt(text: string, jsonPath: JsonPath, name: string): string | undefined {
    const node = findNodeInText(text, jsonPath);
    const splices = node && getRenameSplices(node, name);
    return splices && applySplices(text, splices);
}

export function getRenameSplices(node: Node, name: string): Splice[] | undefined {
    const property = node.parent;
    const key = property?.type === "property" ? property.children?.[0] : undefined;
    if (!property || !key) return undefined;
    const siblings = property.parent?.children ?? [];
    if (siblings.some((each) => each !== property && each.children?.[0]?.value === name)) {
        return undefined;
    }
    return [{ offset: key.offset, length: key.length, text: JSON.stringify(name) }];
}

export function getValueAt(text: string, jsonPath: JsonPath): JsonValue | undefined {
    const node = findNodeInText(text, jsonPath);
    return node === undefined ? undefined : (getNodeValue(node) as JsonValue);
}

function findNodeInText(text: string, jsonPath: JsonPath): Node | undefined {
    const root = parseTree(text);
    return root === undefined ? undefined : findNodeAtLocation(root, [...jsonPath]);
}
