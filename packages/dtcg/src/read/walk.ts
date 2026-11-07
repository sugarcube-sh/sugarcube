import { tokenPath } from "../path.js";
import type { Node } from "jsonc-parser";
import type {
    Diagnostic,
    DiagnosticDetailByKind,
    DiagnosticKind,
    Span,
    JsonValue,
    TokenType,
    WrittenReference,
} from "../model.js";
import { parseReference } from "../values/references.js";
import { isTokenType, tokenTypes } from "../values/token-types.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { type JsonFile, type Member, members, plainObject, plainValue, toSpan } from "./json.js";
import { toPointerSteps } from "./ref-meaning.js";
import { similarName } from "./similar.js";
import type { LoadedSource } from "./sources.js";
import { isTokenKey, OTHER_SPEC_KEYS, OWN_PROPERTIES, type OwnProperty } from "./spec-keys.js";

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
    valueAsWritten: unknown;
    reference: WrittenReference | undefined;
    span: Span;
    extensionsAt?: ExtensionsAt;
}

export interface GroupReference {
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

export interface SourceGroup extends Properties {
    path: string;
    span: Span;
    extensionsAt?: ExtensionsAt;
    extends?: GroupReference;
}

export type SourceMember = { token: SourceToken } | { group: SourceGroup };

export interface SourceContents {
    root: SourceGroup;
    members: SourceMember[];
}

type NonObjectKind = DiagnosticDetailByKind["invalid-member"]["found"];
type Property = Exclude<
    DiagnosticDetailByKind["invalid-property"]["property"],
    "$extends" | "$ref"
>;

const OWN: ReadonlySet<string> = new Set(OWN_PROPERTIES);

const WITHOUT_DOLLAR = new Map(OWN_PROPERTIES.map((property) => [property.slice(1), property]));

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
    ) => diagnostics.push(diagnostic(kind, detail, { span: toSpan(json, node), ...extra }));

    const readType = (path: string, node: Node, name: string) => {
        if (isTokenType(name)) return name;
        const similar = similarName(name, tokenTypes);
        const detail = { type: name, ...(similar !== undefined && { similar }) };
        report("unknown-type", detail, node, { path });
        return "unusable";
    };

    const readProperties = (path: string, entries: readonly Member[]): Properties => {
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

    const readPropertiesAndExtensions = (path: string, entries: readonly Member[]) => {
        const properties = readProperties(path, entries);
        const extensions = entries.find(({ key }) => key === "$extensions")?.value;
        return {
            ...properties,
            ...(properties.extensions &&
                extensions && { extensionsAt: { json, node: extensions } }),
        };
    };

    const readExtends = (node: Node, entries: readonly Member[]): GroupReference | undefined => {
        const value = entries.find(({ key }) => key === "$extends")?.value;
        if (!value) return undefined;
        const reference = parseReference(plainValue(value));
        if (!reference) {
            const suggested = asReference(value.value);
            const detail = { property: "$extends", expected: "reference" } as const;
            report(
                "invalid-property",
                { ...detail, ...(suggested && { reference: suggested }) },
                value,
            );
            return undefined;
        }
        return {
            reference,
            steps: toPointerSteps(reference),
            json,
            node: value,
            span: toSpan(json, value),
            groupSpan: toSpan(json, node),
        };
    };

    const addToken = (
        node: Node,
        path: string,
        entries: readonly Member[],
        value: Node,
        valueAsWritten: unknown,
    ) => {
        written.push({
            token: {
                path,
                json,
                value,
                valueAsWritten,
                reference: parseReference(valueAsWritten),
                span: toSpan(json, node),
                ...readPropertiesAndExtensions(path, entries),
            },
        });
    };

    const visitToken = (node: Node, path: string, entries: readonly Member[], value: Node) => {
        const child = entries.find(({ key }) => isMemberName(key));
        if (child) report("token-and-group", { reason: "child", child: child.key }, child.keyNode);
        addToken(node, path, entries, value, plainValue(value));
    };

    const visitRefToken = (node: Node, path: string, entries: readonly Member[], ref: Node) => {
        const pointer: unknown = ref.value;
        if (typeof pointer !== "string") {
            report("invalid-property", { property: "$ref", expected: "string" }, ref);
            return;
        }
        if (entries.some(({ key }) => isMemberName(key))) {
            report("token-and-group", { reason: "ref", ref: pointer }, ref, { path });
        }
        addToken(node, path, entries, ref, { $ref: pointer });
    };

    const readGroup = (node: Node, path: string, entries: readonly Member[]): SourceGroup => {
        const extending = readExtends(node, entries);
        return {
            path,
            span: toSpan(json, node),
            ...readPropertiesAndExtensions(path, entries),
            ...(extending && { extends: extending }),
        };
    };

    const visitGroup = (node: Node, segments: string[], entries: readonly Member[]) => {
        written.push({ group: readGroup(node, segments.join("."), entries) });
        visitMembers(segments, entries);
    };

    const intended = (entry: Member): OwnProperty | undefined => {
        const { key, value } = entry;
        if (isOwnProperty(key)) return key;
        if (OTHER_SPEC_KEYS.has(key)) return undefined;
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
        const isToken =
            !top && entries.some((entry, index) => isTokenKey(meant[index] ?? entry.key));
        const owner = isToken ? "token" : "group";
        let renamed: Member[] | undefined;
        for (const [index, entry] of entries.entries()) {
            const property = meant[index];
            const { key, keyNode } = entry;
            if (property !== undefined && property !== key) {
                report("misspelt-property", { written: key, property, owner }, keyNode, { path });
                renamed ??= [...entries];
                renamed[index] = { ...entry, key: property };
            } else if (isMisplaced(key, isToken, top)) {
                report("unknown-property", { property: key, owner }, keyNode, { path });
            } else if (property === undefined && key.startsWith("$") && !OTHER_SPEC_KEYS.has(key)) {
                if (holdsToken(entry.value)) {
                    report("invalid-name", { name: key, character: "$" }, keyNode, { path });
                } else if (!top) {
                    report("unknown-property", { property: key, owner }, keyNode, { path });
                } else if (key !== "$schema") {
                    const detail = { property: key, owner, ignored: true } as const;
                    report("unknown-property", detail, keyNode, { path });
                }
            }
        }
        return renamed ?? entries;
    };

    const visitMembers = (segments: string[], entries: readonly Member[]) => {
        for (const { key, keyNode, value } of entries) {
            if (!isMemberName(key)) continue;
            const found = nonObjectKind(value);
            if (found) {
                report("invalid-member", { name: key, found }, value);
                continue;
            }
            const inside = asWritten([...segments, key].join("."), members(value), false);
            const tokenValue = inside.find((entry) => entry.key === "$value")?.value;
            const ref = inside.find((entry) => entry.key === "$ref");
            if (key === "$root" && !tokenValue && !ref) {
                report("invalid-name", { name: key, character: "$" }, keyNode);
                continue;
            }
            const problem = tokenPath.findNameProblem(key);
            if (problem) {
                report("invalid-name", { name: key, ...problem }, keyNode);
                continue;
            }
            if (key !== key.trim()) report("whitespace-in-name", { name: key }, keyNode);

            const path = [...segments, key];
            const joined = path.join(".");
            if (tokenValue) {
                if (ref) report("ref-and-value", {}, ref.keyNode, { path: joined });
                visitToken(value, joined, inside, tokenValue);
            } else if (ref) visitRefToken(value, joined, inside, ref.value);
            else visitGroup(value, path, inside);
        }
    };

    const rootEntries = asWritten(
        "",
        members(tree).filter(({ key }) => !overridden.has(key)),
        true,
    );
    const root = readGroup(tree, "", rootEntries);
    visitMembers([], rootEntries);
    return { root, members: written };
}

function nonObjectKind(node: Node): NonObjectKind | undefined {
    if (node.type === "object" || node.type === "property") return undefined;
    return node.type;
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

function isMisplaced(key: string, isToken: boolean, top: boolean): boolean {
    if (top) return isTokenKey(key);
    return isToken && key === "$extends";
}

function isMemberName(key: string): boolean {
    return !key.startsWith("$") || key === "$root";
}

function holdsToken(node: Node): boolean {
    if (node.type !== "object") return false;
    return members(node).some(({ key, value }) => isTokenKey(key) || holdsToken(value));
}
