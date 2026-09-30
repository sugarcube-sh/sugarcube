import type { Node } from "jsonc-parser";
import type { Diagnostic, DiagnosticDetailByKind, DiagnosticKind, Span } from "../index.js";
import { diagnostic } from "./diagnostics.js";
import { members, plainObject, plainValue, spanOf } from "./json.js";
import type { LoadedSource } from "./sources.js";

export interface Properties {
    type?: string;
    description?: string;
    deprecated?: boolean | string;
    extensions?: Record<string, unknown>;
}

export interface SourceToken extends Properties {
    path: string;
    value: Node;
    authored: unknown;
    at: Span;
}

export interface SourceGroup extends Properties {
    path: string;
    at: Span;
}

export interface SourceContents {
    root: Properties;
    tokens: SourceToken[];
    groups: SourceGroup[];
}

type Member = ReturnType<typeof members>[number];
type NonObjectKind = DiagnosticDetailByKind["invalid-member"]["found"];
type Property = DiagnosticDetailByKind["invalid-property"]["property"];

const FORBIDDEN = [".", "{", "}"] as const;

const EXPECTED: Record<Property, DiagnosticDetailByKind["invalid-property"]["expected"]> = {
    $type: "string",
    $description: "string",
    $deprecated: "boolean-or-string",
    $extensions: "object",
};

export function walkSource(
    source: LoadedSource,
    diagnostics: Diagnostic[],
): SourceContents | undefined {
    const { json, tree } = source;
    if (!json || !tree) return undefined;

    const contents: SourceContents = { root: {}, tokens: [], groups: [] };
    const overridden = new Set(source.overriddenKeys);
    const at = (node: Node) => spanOf(json.path, json.lineStarts, node.offset, node.length);
    const report = <K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        node: Node,
    ) => diagnostics.push(diagnostic(kind, detail, { at: at(node) }));

    const readProperties = (entries: Member[]): Properties => {
        const properties: Properties = {};
        for (const { key, value } of entries) {
            const raw: unknown = value.value;
            if (key === "$type" && typeof raw === "string") properties.type = raw;
            else if (key === "$description" && typeof raw === "string") {
                properties.description = raw;
            } else if (
                key === "$deprecated" &&
                (typeof raw === "string" || typeof raw === "boolean")
            ) {
                properties.deprecated = raw;
            } else if (key === "$extensions" && value.type === "object") {
                properties.extensions = plainObject(value, json.hidden);
            } else if (isProperty(key)) {
                report("invalid-property", { property: key, expected: EXPECTED[key] }, value);
            }
        }
        return properties;
    };

    const visitToken = (node: Node, path: string, entries: Member[], value: Node) => {
        const child = entries.find(({ key }) => !key.startsWith("$"));
        if (child) report("token-and-group", {}, child.keyNode);
        contents.tokens.push({
            path,
            value,
            authored: plainValue(value, json.hidden),
            at: at(node),
            ...readProperties(entries),
        });
    };

    const visitGroup = (node: Node, segments: string[], entries: Member[]) => {
        contents.groups.push({
            path: segments.join("."),
            at: at(node),
            ...readProperties(entries),
        });
        visitMembers(segments, entries);
    };

    const visitMembers = (segments: string[], entries: Member[]) => {
        for (const { key, keyNode, value } of entries) {
            if (key.startsWith("$") && key !== "$root") continue;
            const found = nonObjectKind(value);
            if (found) {
                report("invalid-member", { name: key, found }, value);
                continue;
            }
            const inside = members(value, json.hidden);
            const tokenValue = inside.find((entry) => entry.key === "$value")?.value;
            if (key === "$root" && !tokenValue) {
                report("invalid-name", { name: key, character: "$" }, keyNode);
                continue;
            }
            const character = FORBIDDEN.find((each) => key.includes(each));
            if (character) {
                report("invalid-name", { name: key, character }, keyNode);
                continue;
            }
            if (key !== key.trim()) report("whitespace-in-name", { name: key }, keyNode);

            const path = [...segments, key];
            if (tokenValue) visitToken(value, path.join("."), inside, tokenValue);
            else visitGroup(value, path, inside);
        }
    };

    const rootEntries = members(tree, json.hidden).filter(({ key }) => !overridden.has(key));
    contents.root = readProperties(rootEntries);
    visitMembers([], rootEntries);
    return contents;
}

function nonObjectKind(node: Node): NonObjectKind | undefined {
    if (node.type === "object" || node.type === "property") return undefined;
    return node.type;
}

function isProperty(key: string): key is Property {
    return Object.hasOwn(EXPECTED, key);
}
