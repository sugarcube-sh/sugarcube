import { forbiddenInName } from "../path.js";
import type { Node } from "jsonc-parser";
import type {
    Diagnostic,
    DiagnosticDetailByKind,
    DiagnosticKind,
    Span,
    JsonPointerReference,
    JsonValue,
    TokenType,
    WrittenReference,
} from "../index.js";
import { readReference } from "../values/references.js";
import { isTokenType, tokenTypes } from "../values/token-types.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { type JsonFile, type Member, members, plainObject, plainValue, spanOf } from "./json.js";
import { stepsOf } from "./ref-meaning.js";
import { similarName } from "./similar.js";
import type { LoadedSource } from "./sources.js";

export interface Properties {
    type?: TokenType | "unusable";
    description?: string;
    deprecated?: boolean | string;
    extensions?: Record<string, JsonValue>;
}

export function usableType(type: TokenType | "unusable" | undefined): TokenType | undefined {
    return type === "unusable" ? undefined : type;
}

export interface SourceToken extends Properties {
    path: string;
    json: JsonFile;
    value: Node;
    authored: unknown;
    reference: WrittenReference | undefined;
    span: Span;
    extensionsAt?: ExtensionsAt;
}

export interface GroupReference {
    keyword: "$extends" | "$ref";
    reference: WrittenReference;
    steps: string[] | undefined;
    json: JsonFile;
    node: Node;
    span: Span;
    groupSpan: Span;
}

export interface ExtensionsAt {
    json: JsonFile;
    node: Node;
}

export interface SourceTopLevel extends Properties {
    span: Span;
    extensionsAt?: ExtensionsAt;
}

export interface SourceGroup extends SourceTopLevel {
    path: string;
    extends?: GroupReference;
}

export type SourceMember = { token: SourceToken } | { group: SourceGroup };

export interface SourceContents {
    root: SourceTopLevel;
    members: SourceMember[];
}

type NonObjectKind = DiagnosticDetailByKind["invalid-member"]["found"];
type Property = Exclude<
    DiagnosticDetailByKind["invalid-property"]["property"],
    "$extends" | "$ref"
>;

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

    const written: SourceMember[] = [];
    const overridden = new Set(source.overriddenKeys);
    const report = <K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        node: Node,
        extra: Omit<DiagnosticExtra, "span"> = {},
    ) => diagnostics.push(diagnostic(kind, detail, { span: spanOf(json, node), ...extra }));

    const readType = (path: string | undefined, node: Node, name: string) => {
        if (isTokenType(name)) return name;
        const similar = similarName(name, tokenTypes);
        const detail = { type: name, ...(similar !== undefined && { similar }) };
        report("unknown-type", detail, node, path === undefined ? {} : { path });
        return "unusable";
    };

    const readProperties = (path: string | undefined, entries: readonly Member[]): Properties => {
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
                properties.extensions = plainObject(value);
            } else if (isProperty(key)) {
                report("invalid-property", { property: key, expected: EXPECTED[key] }, value);
                if (key === "$type") properties.type = "unusable";
            }
        }
        return properties;
    };

    const readPropertiesAt = (path: string | undefined, entries: readonly Member[]) => {
        const properties = readProperties(path, entries);
        const extensions = entries.find(({ key }) => key === "$extensions")?.value;
        return {
            ...properties,
            ...(properties.extensions &&
                extensions && { extensionsAt: { json, node: extensions } }),
        };
    };

    const readExtends = (node: Node, entries: readonly Member[]): GroupReference | undefined => {
        let found: GroupReference | undefined;
        for (const { key, value } of entries) {
            if (key !== "$extends" && key !== "$ref") continue;
            const read = readGroupReference(key, plainValue(value));
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
                span: spanOf(json, value),
                groupSpan: spanOf(json, node),
            };
        }
        return found;
    };

    const visitToken = (node: Node, path: string, entries: readonly Member[], value: Node) => {
        const child = entries.find(({ key }) => !key.startsWith("$"));
        if (child) report("token-and-group", { reason: "child", child: child.key }, child.keyNode);
        const authored = plainValue(value);
        written.push({
            token: {
                path,
                json,
                value,
                authored,
                reference: readReference(authored),
                span: spanOf(json, node),
                ...readPropertiesAt(path, entries),
            },
        });
    };

    const visitGroup = (node: Node, segments: string[], entries: readonly Member[]) => {
        const path = segments.join(".");
        const extending = readExtends(node, entries);
        written.push({
            group: {
                path,
                span: spanOf(json, node),
                ...readPropertiesAt(path, entries),
                ...(extending && { extends: extending }),
            },
        });
        visitMembers(segments, entries);
    };

    const intended = (entry: Member): OwnProperty | undefined => {
        const { key, value } = entry;
        if (isOwnProperty(key)) return key;
        if (GROUP_KEYWORDS.has(key)) return undefined;
        if (key.startsWith("$")) return similarName(key, OWN_PROPERTIES);
        const property = WITHOUT_DOLLAR.get(key);
        return property !== undefined && !holdsToken(value) ? property : undefined;
    };

    const asWritten = (
        path: string,
        entries: readonly Member[],
        top: boolean,
    ): readonly Member[] => {
        const meant = entries.map((entry) => {
            const property = intended(entry);
            if (property === entry.key) return property;
            if (property === undefined || entries.some(({ key }) => key === property)) {
                return undefined;
            }
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

    const visitMembers = (segments: string[], entries: readonly Member[]) => {
        for (const { key, keyNode, value } of entries) {
            if (key.startsWith("$") && key !== "$root") continue;
            const found = nonObjectKind(value);
            if (found) {
                report("invalid-member", { name: key, found }, value);
                continue;
            }
            const inside = asWritten([...segments, key].join("."), members(value), false);
            const tokenValue = inside.find((entry) => entry.key === "$value")?.value;
            if (key === "$root" && !tokenValue) {
                report("invalid-name", { name: key, character: "$" }, keyNode);
                continue;
            }
            const character = forbiddenInName(key);
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
        members(tree).filter(({ key }) => !overridden.has(key)),
        true,
    );
    const root = { span: spanOf(json, tree), ...readPropertiesAt(undefined, rootEntries) };
    visitMembers([], rootEntries);
    return { root, members: written };
}

function nonObjectKind(node: Node): NonObjectKind | undefined {
    if (node.type === "object" || node.type === "property") return undefined;
    return node.type;
}

function readGroupReference(
    keyword: "$extends" | "$ref",
    raw: unknown,
): Pick<GroupReference, "reference" | "steps"> | undefined {
    const reference = keyword === "$extends" ? readReference(raw) : pointerOf(raw);
    return reference && { reference, steps: stepsOf(reference) };
}

function pointerOf(raw: unknown): JsonPointerReference | undefined {
    return typeof raw === "string" ? { syntax: "json-pointer", pointer: raw } : undefined;
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

function holdsToken(node: Node): boolean {
    if (node.type !== "object") return false;
    return members(node).some(({ key, value }) => key === "$value" || holdsToken(value));
}
