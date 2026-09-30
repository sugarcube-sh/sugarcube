import type { Node } from "jsonc-parser";
import { fixTitles } from "../error-messages.js";
import type {
    Diagnostic,
    DiagnosticDetailByKind,
    DiagnosticKind,
    Fix,
    Span,
    TokenType,
} from "../index.js";
import { readAlias, readPointer } from "../values/references.js";
import { isTokenType, tokenTypes } from "../values/token-types.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { members, plainObject, plainValue, spanOf } from "./json.js";
import { parsePointer } from "./pointer.js";
import { similarName } from "./similar.js";
import type { LoadedSource } from "./sources.js";

export interface Properties {
    type?: TokenType | "unusable";
    description?: string;
    deprecated?: boolean | string;
    extensions?: Record<string, unknown>;
}

export interface SourceToken extends Properties {
    path: string;
    value: Node;
    authored: unknown;
    isReference: boolean;
    at: Span;
}

export interface GroupReference {
    keyword: "$extends" | "$ref";
    written: string;
    steps: string[] | undefined;
    node: Node;
    at: Span;
    declaredAt: Span;
}

export interface SourceGroup extends Properties {
    path: string;
    at: Span;
    extends?: GroupReference;
}

export interface SourceContents {
    root: Properties;
    tokens: SourceToken[];
    groups: SourceGroup[];
}

type Member = ReturnType<typeof members>[number];
type NonObjectKind = DiagnosticDetailByKind["invalid-member"]["found"];
type Property = Exclude<
    DiagnosticDetailByKind["invalid-property"]["property"],
    "$extends" | "$ref"
>;

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
        extra: Omit<DiagnosticExtra, "at"> = {},
    ) => diagnostics.push(diagnostic(kind, detail, { at: at(node), ...extra }));

    const readType = (path: string, node: Node, name: string): TokenType | "unusable" => {
        if (isTokenType(name)) return name;
        const similar = similarName(name, tokenTypes);
        report("unknown-type", { type: name }, node, {
            path,
            ...(similar && { fixes: [typeFix(json.path, node, similar)] }),
        });
        return "unusable";
    };

    const readProperties = (path: string, entries: Member[]): Properties => {
        const properties: Properties = {};
        for (const { key, value } of entries) {
            const raw: unknown = value.value;
            if (key === "$type" && typeof raw === "string") {
                properties.type = readType(path, value, raw);
            } else if (key === "$description" && typeof raw === "string") {
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
                if (key === "$type") properties.type = "unusable";
            }
        }
        return properties;
    };

    const readExtends = (node: Node, entries: Member[]): GroupReference | undefined => {
        let found: GroupReference | undefined;
        for (const { key, value } of entries) {
            if (key !== "$extends" && key !== "$ref") continue;
            const read = readGroupReference(key, plainValue(value, json.hidden));
            if (read === undefined) {
                const expected = key === "$ref" ? "string" : "reference";
                report("invalid-property", { property: key, expected }, value);
                continue;
            }
            found = { keyword: key, ...read, node: value, at: at(value), declaredAt: at(node) };
        }
        return found;
    };

    const visitToken = (node: Node, path: string, entries: Member[], value: Node) => {
        const child = entries.find(({ key }) => !key.startsWith("$"));
        if (child) report("token-and-group", {}, child.keyNode);
        const authored = plainValue(value, json.hidden);
        contents.tokens.push({
            path,
            value,
            authored,
            isReference: readAlias(authored) !== undefined || readPointer(authored) !== undefined,
            at: at(node),
            ...readProperties(path, entries),
        });
    };

    const visitGroup = (node: Node, segments: string[], entries: Member[]) => {
        const path = segments.join(".");
        const extending = readExtends(node, entries);
        contents.groups.push({
            path,
            at: at(node),
            ...readProperties(path, entries),
            ...(extending && { extends: extending }),
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
    contents.root = readProperties("", rootEntries);
    visitMembers([], rootEntries);
    return contents;
}

function nonObjectKind(node: Node): NonObjectKind | undefined {
    if (node.type === "object" || node.type === "property") return undefined;
    return node.type;
}

function readGroupReference(
    keyword: "$extends" | "$ref",
    raw: unknown,
): Pick<GroupReference, "written" | "steps"> | undefined {
    const pointerSteps = (pointer: string) =>
        pointer.startsWith("#") ? parsePointer(pointer) : undefined;
    if (keyword === "$ref") {
        return typeof raw === "string" ? { written: raw, steps: pointerSteps(raw) } : undefined;
    }
    const alias = readAlias(raw);
    if (alias) return { written: alias.alias, steps: alias.alias.split(".") };
    const pointer = readPointer(raw);
    return pointer && { written: pointer.pointer, steps: pointerSteps(pointer.pointer) };
}

function typeFix(file: string, node: Node, type: TokenType): Fix {
    return {
        title: fixTitles.useType(type),
        safe: false,
        edits: [{ file, offset: node.offset, length: node.length, text: JSON.stringify(type) }],
    };
}

function isProperty(key: string): key is Property {
    return Object.hasOwn(EXPECTED, key);
}
