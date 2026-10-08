import type { Node } from "jsonc-parser";
import type {
    Alias,
    Diagnostic,
    DiagnosticDetailByKind,
    DiagnosticKind,
    Pointer,
    Span,
    TokenType,
} from "../index.js";
import { readAlias, readPointer, readReference } from "../values/references.js";
import { isTokenType, tokenTypes } from "../values/token-types.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { type JsonFile, members, plainObject, plainValue, spanOf } from "./json.js";
import { refSteps } from "./pointer.js";
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
    json: JsonFile;
    value: Node;
    authored: unknown;
    reference: Alias | Pointer | undefined;
    at: Span;
}

export interface GroupReference {
    keyword: "$extends" | "$ref";
    written: string;
    steps: string[] | undefined;
    json: JsonFile;
    node: Node;
    at: Span;
    declaredAt: Span;
}

export interface ExtensionsAt {
    json: JsonFile;
    node: Node;
}

export interface SourceGroup extends Properties {
    path: string;
    at: Span;
    extends?: GroupReference;
    extensionsAt?: ExtensionsAt;
}

export interface SourceContents {
    root: SourceGroup;
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

type OwnProperty = DiagnosticDetailByKind["misspelt-property"]["property"];

const OWN_PROPERTIES: readonly OwnProperty[] = [
    "$value",
    "$type",
    "$description",
    "$deprecated",
    "$extensions",
];

const OWN: ReadonlySet<string> = new Set(OWN_PROPERTIES);

const WITHOUT_DOLLAR = new Map(OWN_PROPERTIES.map((property) => [property.slice(1), property]));

const GROUP_KEYWORDS = new Set(["$extends", "$ref", "$root"]);

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

    const at = (node: Node) => spanOf(json.path, json.lineStarts, node.offset, node.length);
    const contents: SourceContents = { root: { path: "", at: at(tree) }, tokens: [], groups: [] };
    const overridden = new Set(source.overriddenKeys);
    const report = <K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        node: Node,
        extra: Omit<DiagnosticExtra, "at"> = {},
    ) => diagnostics.push(diagnostic(kind, detail, { at: at(node), ...extra }));

    const readType = (path: string, node: Node, name: string) => {
        if (isTokenType(name)) return name;
        const similar = similarName(name, tokenTypes);
        const detail = { type: name, ...(similar !== undefined && { similar }) };
        report("unknown-type", detail, node, { path });
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

    const readGroupProperties = (path: string, entries: Member[]) => {
        const properties = readProperties(path, entries);
        const extensions = entries.find(({ key }) => key === "$extensions")?.value;
        return {
            ...properties,
            ...(properties.extensions &&
                extensions && { extensionsAt: { json, node: extensions } }),
        };
    };

    const readExtends = (node: Node, entries: Member[]): GroupReference | undefined => {
        let found: GroupReference | undefined;
        for (const { key, value } of entries) {
            if (key !== "$extends" && key !== "$ref") continue;
            const read = readGroupReference(key, plainValue(value, json.hidden));
            if (read === undefined) {
                const expected = key === "$ref" ? "string" : "reference";
                const reference = key === "$extends" ? asReference(value.value) : undefined;
                report(
                    "invalid-property",
                    { property: key, expected, ...(reference !== undefined && { reference }) },
                    value,
                );
                continue;
            }
            found = {
                keyword: key,
                ...read,
                json,
                node: value,
                at: at(value),
                declaredAt: at(node),
            };
        }
        return found;
    };

    const visitToken = (node: Node, path: string, entries: Member[], value: Node) => {
        const child = entries.find(({ key }) => !key.startsWith("$"));
        if (child) report("token-and-group", { reason: "child", child: child.key }, child.keyNode);
        const authored = plainValue(value, json.hidden);
        contents.tokens.push({
            path,
            json,
            value,
            authored,
            reference: readReference(authored),
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
            ...readGroupProperties(path, entries),
            ...(extending && { extends: extending }),
        });
        visitMembers(segments, entries);
    };

    const intended = (entry: Member): OwnProperty | undefined => {
        const { key, value } = entry;
        if (isOwnProperty(key)) return key;
        if (GROUP_KEYWORDS.has(key)) return undefined;
        if (key.startsWith("$")) return similarName(key, OWN_PROPERTIES);
        const property = WITHOUT_DOLLAR.get(key);
        return property !== undefined && !holdsToken(value, json) ? property : undefined;
    };

    const asWritten = (path: string, entries: Member[], top: boolean): Member[] => {
        const meant = entries.map((entry) => {
            const property = intended(entry);
            return top && property === "$value" ? undefined : property;
        });
        const owner = meant.includes("$value") ? "token" : "group";
        let renamed: Member[] | undefined;
        for (const [index, entry] of entries.entries()) {
            const property = meant[index];
            const { key, keyNode } = entry;
            if (property !== undefined && property !== key) {
                report("misspelt-property", { written: key, property, owner }, keyNode, { path });
                renamed ??= [...entries];
                renamed[index] = { ...entry, key: property };
            } else if (
                property === undefined &&
                key.startsWith("$") &&
                !GROUP_KEYWORDS.has(key) &&
                !top
            ) {
                report("unknown-property", { property: key, owner }, keyNode, { path });
            }
        }
        return renamed ?? entries;
    };

    const visitMembers = (segments: string[], entries: Member[]) => {
        for (const { key, keyNode, value } of entries) {
            if (key.startsWith("$") && key !== "$root") continue;
            const found = nonObjectKind(value);
            if (found) {
                report("invalid-member", { name: key, found }, value);
                continue;
            }
            const inside = asWritten(
                [...segments, key].join("."),
                members(value, json.hidden),
                false,
            );
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

    const rootEntries = asWritten(
        "",
        members(tree, json.hidden).filter(({ key }) => !overridden.has(key)),
        true,
    );
    contents.root = { path: "", at: at(tree), ...readGroupProperties("", rootEntries) };
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
    if (keyword === "$ref") {
        return typeof raw === "string" ? { written: raw, steps: refSteps(raw) } : undefined;
    }
    const alias = readAlias(raw);
    if (alias) return { written: alias.alias, steps: alias.alias.split(".") };
    const pointer = readPointer(raw);
    return pointer && { written: pointer.pointer, steps: refSteps(pointer.pointer) };
}

function asReference(written: unknown): string | undefined {
    if (typeof written !== "string" || written === "" || /[{}#]/.test(written)) return undefined;
    return `{${written}}`;
}

function isProperty(key: string): key is Property {
    return Object.hasOwn(EXPECTED, key);
}

function isOwnProperty(key: string): key is OwnProperty {
    return OWN.has(key);
}

function holdsToken(node: Node, json: JsonFile): boolean {
    if (node.type !== "object") return false;
    return members(node, json.hidden).some(
        ({ key, value }) => key === "$value" || holdsToken(value, json),
    );
}
