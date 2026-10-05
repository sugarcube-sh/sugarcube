import type { Node } from "jsonc-parser";
import type { IgnoredProperty, JsonPath, Span } from "../index.js";
import { isJsonObject } from "../values/json.js";
import { readAlias, readPointer } from "../values/references.js";
import { type JsonFile, member, spanOf } from "./json.js";
import { refSteps } from "./pointer.js";

export type Occurrence =
    | { kind: "alias"; target: string; path: JsonPath; at: Span }
    | {
          kind: "pointer";
          written: string;
          steps: string[] | undefined;
          path: JsonPath;
          at: Span;
          pointerAt: Span;
      };

export function keptReferences(found: Occurrence[], ignored: IgnoredProperty[]): Occurrence[] {
    if (ignored.length === 0) return found;
    const setAside = ignored.map(({ path }) => path.slice(1));
    return found.filter((each) => !setAside.some((path) => startsWith(each.path, path)));
}

export function withoutIgnored(raw: unknown, ignored: IgnoredProperty[]): unknown {
    if (ignored.length === 0) return raw;
    const setAside = ignored.map(({ path }) => path.slice(1));
    const kept = (value: unknown, at: JsonPath): unknown => {
        if (Array.isArray(value)) return value.map((item, index) => kept(item, [...at, index]));
        if (!isJsonObject(value)) return value;
        return Object.fromEntries(
            Object.entries(value)
                .filter(([key]) => !setAside.some((path) => equal(path, [...at, key])))
                .map(([key, item]) => [key, kept(item, [...at, key])]),
        );
    };
    return kept(raw, []);
}

function startsWith(path: JsonPath, start: JsonPath): boolean {
    return start.length <= path.length && start.every((step, i) => path[i] === step);
}

function equal(a: JsonPath, b: JsonPath): boolean {
    return a.length === b.length && startsWith(a, b);
}

export function referencesIn(raw: unknown, node: Node, json: JsonFile): Occurrence[] {
    const found: Occurrence[] = [];
    const visit = (each: unknown, at: Node, path: JsonPath) => {
        const span = () => spanOf(json.path, json.lineStarts, at.offset, at.length);
        const alias = readAlias(each);
        const pointer = readPointer(each);
        if (alias) found.push({ kind: "alias", target: alias.alias, path, at: span() });
        else if (pointer) {
            const { pointer: written } = pointer;
            const text = member(at, "$ref", json.hidden) ?? at;
            const pointerAt = spanOf(json.path, json.lineStarts, text.offset, text.length);
            const steps = refSteps(written);
            found.push({ kind: "pointer", written, steps, path, at: span(), pointerAt });
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
