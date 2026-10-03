import type { Node } from "jsonc-parser";
import type { JsonPath, Span } from "../index.js";
import { isJsonObject } from "../values/json.js";
import { readAlias, readPointer } from "../values/references.js";
import { type JsonFile, member, spanOf } from "./json.js";
import { refSteps } from "./pointer.js";

export type Occurrence =
    | { kind: "alias"; target: string; path: JsonPath; at: Span }
    | { kind: "pointer"; written: string; steps: string[] | undefined; path: JsonPath; at: Span };

export function referencesIn(raw: unknown, node: Node, json: JsonFile): Occurrence[] {
    const found: Occurrence[] = [];
    const visit = (each: unknown, at: Node, path: JsonPath) => {
        const span = () => spanOf(json.path, json.lineStarts, at.offset, at.length);
        const alias = readAlias(each);
        const pointer = readPointer(each);
        if (alias) found.push({ kind: "alias", target: alias.alias, path, at: span() });
        else if (pointer) {
            const { pointer: written } = pointer;
            found.push({ kind: "pointer", written, steps: refSteps(written), path, at: span() });
        } else if (Array.isArray(each)) {
            each.forEach((item, index) => {
                const child = at.type === "array" ? at.children?.[index] : undefined;
                if (child) visit(item, child, [...path, index]);
            });
        } else if (isJsonObject(each)) {
            for (const [key, item] of Object.entries(each)) {
                const child = member(at, key, json.hidden);
                if (child) visit(item, child, [...path, key]);
            }
        }
    };
    visit(raw, node, []);
    return found;
}
