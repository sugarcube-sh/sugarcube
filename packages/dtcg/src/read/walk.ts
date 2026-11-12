import { tokenPath } from "../path.js";
import type { Node } from "jsonc-parser";
import type {
    Diagnostic,
    DiagnosticDetailByKind,
    DiagnosticKind,
    Span,
    JsonValue,
    TokenType,
    ParsedReference,
} from "../model.js";
import { parseReference } from "../values/references.js";
import { isTokenType, tokenTypes } from "../values/token-types.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import {
    type JsonFile,
    type Member,
    members,
    getKeyNode,
    toPlainObject,
    toPlainValue,
    toSpan,
} from "./json.js";
import { toPointerSteps } from "./ref-meaning.js";
import { similarName } from "./similar.js";
import type { LoadedSource } from "./sources.js";
import { isTokenKey, OTHER_SPEC_KEYS, OWN_PROPERTIES, type OwnProperty } from "./spec-keys.js";

export interface Properties {
    type?: TokenType | "invalid";
    description?: string;
    deprecated?: boolean | string;
    extensions?: Record<string, JsonValue>;
}

export function toValidType(type: TokenType | "invalid" | undefined): TokenType | undefined {
    return type === "invalid" ? undefined : type;
}

export interface SourceToken extends Properties {
    path: string;
    json: JsonFile;
    value: Node;
    originalValue: unknown;
    reference: ParsedReference | undefined;
    span: Span;
    nameSpan: Span;
    extensionsLocation?: ExtensionsLocation;
}

export interface GroupReference {
    reference: ParsedReference;
    steps: string[] | undefined;
    json: JsonFile;
    node: Node;
    span: Span;
    groupSpan: Span;
}

export interface ExtensionsLocation {
    json: JsonFile;
    node: Node;
}

export interface SourceGroup extends Properties {
    path: string;
    span: Span;
    nameSpan: Span;
    extensionsLocation?: ExtensionsLocation;
    extends?: GroupReference;
}

export type SourceMember = { token: SourceToken } | { group: SourceGroup };

export interface SourceContents {
    root: SourceGroup;
    members: SourceMember[];
}

interface FileWalk {
    json: JsonFile;
    members: SourceMember[];
    report<K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        node: Node,
        extra?: Omit<DiagnosticExtra, "span">,
    ): void;
}

type Level = "top" | "member";

type Owner = "token" | "group";

type NonObjectKind = DiagnosticDetailByKind["invalid-member"]["found"];

type Property = Exclude<
    DiagnosticDetailByKind["invalid-property"]["property"],
    "$extends" | "$ref"
>;

const OWN: ReadonlySet<string> = new Set(OWN_PROPERTIES);

const PROPERTY_BY_BARE_NAME = new Map(
    OWN_PROPERTIES.map((property) => [property.slice(1), property]),
);

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

    const walk = createFileWalk(json, diagnostics);
    const overridden = new Set(source.overriddenKeys);
    const topEntries = members(tree).filter(({ key }) => !overridden.has(key));
    const entries = correctKeys(walk, "", topEntries, "top");

    const root = readGroup(walk, tree, "", entries);
    walkMembers(walk, [], entries);
    return { root, members: walk.members };
}

function createFileWalk(json: JsonFile, diagnostics: Diagnostic[]): FileWalk {
    return {
        json,
        members: [],
        report: (kind, detail, node, extra = {}) => {
            diagnostics.push(diagnostic(kind, detail, { span: toSpan(json, node), ...extra }));
        },
    };
}

function walkMembers(walk: FileWalk, segments: string[], entries: readonly Member[]): void {
    for (const entry of entries) walkMember(walk, segments, entry);
}

function walkMember(walk: FileWalk, segments: string[], { key, keyNode, value }: Member): void {
    if (!isMemberName(key)) return;

    const found = findNonObjectKind(value);
    if (found) {
        walk.report("invalid-member", { name: key, found }, value);
        return;
    }

    const path = [...segments, key];
    const joined = path.join(".");
    const entries = correctKeys(walk, joined, members(value), "member");
    const tokenValue = findEntry(entries, "$value")?.value;
    const ref = findEntry(entries, "$ref");

    const isToken = tokenValue !== undefined || ref !== undefined;
    if (!checkMemberName(walk, key, keyNode, isToken)) return;

    if (tokenValue) {
        if (ref) walk.report("ref-and-value", {}, ref.keyNode, { path: joined });
        walkValueToken(walk, value, joined, entries, tokenValue);
        return;
    }
    if (ref) {
        walkRefToken(walk, value, joined, entries, ref.value);
        return;
    }
    walkGroup(walk, value, path, entries);
}

function checkMemberName(walk: FileWalk, key: string, keyNode: Node, isToken: boolean): boolean {
    if (key === "$root" && !isToken) {
        walk.report("invalid-name", { name: key, character: "$" }, keyNode);
        return false;
    }

    const problem = tokenPath.findNameProblem(key);
    if (problem) {
        walk.report("invalid-name", { name: key, ...problem }, keyNode);
        return false;
    }

    if (key !== key.trim()) walk.report("whitespace-in-name", { name: key }, keyNode);
    return true;
}

function walkValueToken(
    walk: FileWalk,
    node: Node,
    path: string,
    entries: readonly Member[],
    value: Node,
): void {
    const child = entries.find(({ key }) => isMemberName(key));
    if (child) {
        const found = findNonObjectKind(child.value) ?? "object";
        const detail = { reason: "child", child: child.key, found } as const;
        walk.report("token-and-group", detail, child.keyNode);
    }

    addToken(walk, node, path, entries, value, toPlainValue(value));
}

function walkRefToken(
    walk: FileWalk,
    node: Node,
    path: string,
    entries: readonly Member[],
    ref: Node,
): void {
    const pointer: unknown = ref.value;
    if (typeof pointer !== "string") {
        walk.report("invalid-property", { property: "$ref", expected: "string" }, ref);
        return;
    }

    if (entries.some(({ key }) => isMemberName(key))) {
        walk.report("token-and-group", { reason: "ref", ref: pointer }, ref, { path });
    }

    addToken(walk, node, path, entries, ref, { $ref: pointer });
}

function addToken(
    walk: FileWalk,
    node: Node,
    path: string,
    entries: readonly Member[],
    value: Node,
    originalValue: unknown,
): void {
    const { json } = walk;
    const token: SourceToken = {
        path,
        json,
        value,
        originalValue,
        reference: parseReference(originalValue),
        span: toSpan(json, node),
        nameSpan: toSpan(json, getKeyNode(node)),
        ...readProperties(walk, path, entries),
    };
    walk.members.push({ token });
}

function walkGroup(walk: FileWalk, node: Node, segments: string[], entries: readonly Member[]) {
    const group = readGroup(walk, node, segments.join("."), entries);
    walk.members.push({ group });
    walkMembers(walk, segments, entries);
}

function readGroup(
    walk: FileWalk,
    node: Node,
    path: string,
    entries: readonly Member[],
): SourceGroup {
    const { json } = walk;
    const extending = readExtends(walk, node, entries);
    return {
        path,
        span: toSpan(json, node),
        nameSpan: toSpan(json, getKeyNode(node)),
        ...readProperties(walk, path, entries),
        ...(extending && { extends: extending }),
    };
}

function readExtends(
    walk: FileWalk,
    groupNode: Node,
    entries: readonly Member[],
): GroupReference | undefined {
    const value = findEntry(entries, "$extends")?.value;
    if (!value) return undefined;

    const reference = parseReference(toPlainValue(value));
    if (!reference) {
        reportInvalidExtends(walk, value);
        return undefined;
    }

    const { json } = walk;
    return {
        reference,
        steps: toPointerSteps(reference),
        json,
        node: value,
        span: toSpan(json, value),
        groupSpan: toSpan(json, groupNode),
    };
}

function reportInvalidExtends(walk: FileWalk, value: Node): void {
    const detail = { property: "$extends", expected: "reference" } as const;
    const suggested = suggestReference(value.value);
    if (suggested === undefined) {
        walk.report("invalid-property", detail, value);
        return;
    }
    walk.report("invalid-property", { ...detail, reference: suggested }, value);
}

function readProperties(
    walk: FileWalk,
    path: string,
    entries: readonly Member[],
): Properties & { extensionsLocation?: ExtensionsLocation } {
    const properties: Properties & { extensionsLocation?: ExtensionsLocation } = {};
    for (const { key, value } of entries) {
        const raw: unknown = value.value;
        if (key === "$type" && typeof raw === "string") {
            properties.type = readType(walk, path, value, raw);
        } else if (key === "$description" && typeof raw === "string") {
            properties.description = raw;
        } else if (key === "$deprecated" && (typeof raw === "string" || typeof raw === "boolean")) {
            properties.deprecated = raw;
        } else if (key === "$extensions" && value.type === "object") {
            properties.extensions = toPlainObject(value);
            properties.extensionsLocation = { json: walk.json, node: value };
        } else if (isProperty(key)) {
            walk.report("invalid-property", { property: key, expected: EXPECTED[key] }, value);
            if (key === "$type") properties.type = "invalid";
        }
    }
    return properties;
}

function readType(walk: FileWalk, path: string, node: Node, name: string): TokenType | "invalid" {
    if (isTokenType(name)) return name;

    const suggestion = similarName(name, tokenTypes);
    const detail = { type: name, ...(suggestion !== undefined && { suggestion }) };
    walk.report("unknown-type", detail, node, { path });
    return "invalid";
}

function correctKeys(
    walk: FileWalk,
    path: string,
    entries: readonly Member[],
    level: Level,
): readonly Member[] {
    const intendedKeys = entries.map((entry) => findIntendedKey(entry, entries, level));
    const owner: Owner = isTokenObject(entries, intendedKeys, level) ? "token" : "group";

    let corrected: Member[] | undefined;
    for (const [index, entry] of entries.entries()) {
        const intended = intendedKeys[index];
        const { key, keyNode } = entry;

        if (intended !== undefined && intended !== key) {
            const detail = { key, property: intended, owner };
            walk.report("misspelt-property", detail, keyNode, { path });
            corrected ??= [...entries];
            corrected[index] = { ...entry, key: intended };
            continue;
        }

        reportKeyProblem(walk, path, entry, intended, owner, level);
    }
    return corrected ?? entries;
}

function findIntendedKey(
    entry: Member,
    entries: readonly Member[],
    level: Level,
): OwnProperty | undefined {
    const property = guessIntendedProperty(entry);
    if (property === entry.key) return property;
    if (property === undefined) return undefined;

    const alreadyWritten = entries.some(({ key }) => key === property);
    if (alreadyWritten) return undefined;
    if (level === "top" && property === "$value") return undefined;
    return property;
}

function guessIntendedProperty({ key, value }: Member): OwnProperty | undefined {
    if (isOwnProperty(key)) return key;
    if (OTHER_SPEC_KEYS.has(key)) return undefined;
    if (key.startsWith("$")) return similarName(key, OWN_PROPERTIES);

    const property = PROPERTY_BY_BARE_NAME.get(key);
    if (property === undefined || containsToken(value)) return undefined;
    return property;
}

function isTokenObject(
    entries: readonly Member[],
    intendedKeys: readonly (OwnProperty | undefined)[],
    level: Level,
): boolean {
    if (level === "top") return false;
    return entries.some((entry, index) => isTokenKey(intendedKeys[index] ?? entry.key));
}

function reportKeyProblem(
    walk: FileWalk,
    path: string,
    { key, keyNode, value }: Member,
    intended: OwnProperty | undefined,
    owner: Owner,
    level: Level,
): void {
    if (isMisplaced(key, owner, level)) {
        walk.report("unknown-property", { property: key, owner }, keyNode, { path });
        return;
    }

    const isUnknownSpecKey = key.startsWith("$") && !OTHER_SPEC_KEYS.has(key);
    if (intended !== undefined || !isUnknownSpecKey) return;

    if (containsToken(value)) {
        walk.report("invalid-name", { name: key, character: "$" }, keyNode, { path });
        return;
    }
    if (level === "member") {
        walk.report("unknown-property", { property: key, owner }, keyNode, { path });
        return;
    }
    if (key === "$schema") return;

    const detail = { property: key, owner, ignored: true } as const;
    walk.report("unknown-property", detail, keyNode, { path });
}

function isMisplaced(key: string, owner: Owner, level: Level): boolean {
    if (level === "top") return isTokenKey(key);
    return owner === "token" && key === "$extends";
}

function findEntry(entries: readonly Member[], key: string): Member | undefined {
    return entries.find((entry) => entry.key === key);
}

function findNonObjectKind(node: Node): NonObjectKind | undefined {
    if (node.type === "object" || node.type === "property") return undefined;
    return node.type;
}

function suggestReference(value: unknown): string | undefined {
    if (typeof value !== "string" || value === "" || /[{}#]/.test(value)) return undefined;
    return `{${value}}`;
}

function isProperty(key: string): key is Property {
    return Object.hasOwn(EXPECTED, key);
}

function isOwnProperty(key: string): key is OwnProperty {
    return OWN.has(key);
}

function isMemberName(key: string): boolean {
    return !key.startsWith("$") || key === "$root";
}

function containsToken(node: Node): boolean {
    if (node.type !== "object") return false;
    return members(node).some(({ key, value }) => isTokenKey(key) || containsToken(value));
}
