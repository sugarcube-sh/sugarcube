import type { Node } from "jsonc-parser";
import type {
    Diagnostic,
    DiagnosticDetailByKind,
    DiagnosticKind,
    JsonPath,
    ResolverProblem,
} from "../model.js";
import { type DiagnosticExtra, diagnostic, type Problems } from "./diagnostics.js";
import { type JsonFile, member, members, spanOf } from "./json.js";
import { malformedPointer } from "./malformed-pointer.js";
import { readPointerText } from "./pointer.js";
import { similarName } from "./similar.js";

const ROOT_KEYS = [
    "version",
    "name",
    "description",
    "sets",
    "modifiers",
    "resolutionOrder",
    "$schema",
    "$defs",
];
export const SET_KEYS = ["sources", "description", "$extensions"];
const MODIFIER_KEYS = ["contexts", "description", "default", "$extensions"];
const INLINE_KEYS = ["type", "name"];

export interface ResolverNode {
    node: Node;
    jsonPath: JsonPath;
}

export interface SetDefinition {
    name: string;
    sources: ResolverNode[];
    description?: string;
    extensions?: Node;
    declared: Node;
}

export interface ContextDefinition {
    sources: ResolverNode[];
    declared: Node;
}

export interface ModifierDefinition {
    name: string;
    contexts: Map<string, ContextDefinition>;
    default?: string;
    description?: string;
    extensions?: Node;
    declared: Node;
}

export type ResolverItem =
    | { kind: "set"; set: SetDefinition }
    | { kind: "modifier"; modifier: ModifierDefinition };

export interface CheckedResolver {
    file: JsonFile;
    version?: string;
    name?: string;
    description?: string;
    sets: Map<string, SetDefinition>;
    modifiers: Map<string, ModifierDefinition>;
    order: ResolverItem[];
}

type JsonType = "string" | "object" | "array";

export type StringNode = Omit<Node, "value"> & { type: "string"; value: string };

type NodeOf<T extends JsonType> = T extends "string" ? StringNode : Node;

export function isStringNode(node: Node | undefined): node is StringNode {
    return node?.type === "string";
}

export interface Reader {
    report(problem: ResolverProblem, node: Node, extra?: Omit<DiagnosticExtra, "span">): void;
    diagnose<K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        node: Node,
        extra?: Omit<DiagnosticExtra, "span">,
    ): void;
    expect<T extends JsonType>(
        node: Node | undefined,
        type: T,
        name: string,
        jsonPath: JsonPath,
    ): node is NodeOf<T>;
    checkKeys(
        owner: ResolverNode,
        kind: Exclude<DiagnosticDetailByKind["unknown-property"], { jsonPath: JsonPath }>["owner"],
        known: readonly string[],
    ): void;
}

export function isResolver(file: string, root: Node | undefined): boolean {
    return (
        isResolverName(file) ||
        (root !== undefined && member(root, "resolutionOrder") !== undefined)
    );
}

export function isResolverName(file: string): boolean {
    return file.endsWith(".resolver.json");
}

export function checkResolver(file: JsonFile, diagnostics: Problems): CheckedResolver {
    const reader = createReader(file, diagnostics);
    const root: ResolverNode = { node: file.root, jsonPath: [] };

    const version = member(root.node, "version");
    if (!isStringNode(version) || version.value !== "2025.10") {
        reader.report(
            { rule: "version", name: "version", jsonPath: ["version"] },
            version ?? root.node,
        );
    }
    const name = optional(reader, root, "name", "string");
    const description = optional(reader, root, "description", "string");
    reader.checkKeys(root, "resolver", ROOT_KEYS);

    const sets = readAll(reader, root, "sets", readSet);
    const modifiers = readAll(reader, root, "modifiers", readModifier);
    const order = readOrder(reader, root, sets, modifiers);
    return {
        file,
        ...(isStringNode(version) && { version: version.value }),
        ...(name && { name: name.value }),
        ...(description && { description: description.value }),
        sets,
        modifiers,
        order,
    };
}

export function resolverProblem(
    file: JsonFile,
    problem: ResolverProblem,
    node: Node,
    extra: Omit<DiagnosticExtra, "span"> = {},
): Diagnostic {
    return diagnostic("resolver-invalid", problem, {
        ...extra,
        span: spanOf(file, node),
    });
}

export function createReader(file: JsonFile, diagnostics: Problems): Reader {
    const reader: Reader = {
        report: (problem, node, extra) =>
            diagnostics.found(resolverProblem(file, problem, node, extra)),
        diagnose: (kind, detail, node, extra = {}) => {
            const span = spanOf(file, node);
            diagnostics.found(diagnostic(kind, detail, { ...extra, span }));
        },
        expect: <T extends JsonType>(
            node: Node | undefined,
            type: T,
            name: string,
            jsonPath: JsonPath,
        ): node is NodeOf<T> => {
            if (!node) return false;
            if (node.type === type) return true;
            reader.report({ rule: "wrong-type", name, jsonPath, expected: type }, node);
            return false;
        },
        checkKeys: (owner, kind, known) => {
            for (const { key, keyNode } of members(owner.node)) {
                if (known.includes(key)) continue;
                const similar = similarName(key, known);
                const span = spanOf(file, keyNode);
                const detail = {
                    property: key,
                    owner: kind,
                    ...(similar !== undefined && { similar }),
                };
                diagnostics.found(diagnostic("unknown-property", detail, { span }));
            }
        },
    };
    return reader;
}

function present(reader: Reader, owner: ResolverNode, key: string): Node | undefined {
    const found = member(owner.node, key);
    if (!found)
        reader.report(
            { rule: "missing-property", name: key, jsonPath: owner.jsonPath },
            owner.node,
        );
    return found;
}

function required<T extends JsonType>(
    reader: Reader,
    owner: ResolverNode,
    key: string,
    type: T,
): NodeOf<T> | undefined {
    const found = present(reader, owner, key);
    return reader.expect(found, type, key, [...owner.jsonPath, key]) ? found : undefined;
}

function optional<T extends JsonType>(
    reader: Reader,
    owner: ResolverNode,
    key: string,
    type: T,
): NodeOf<T> | undefined {
    const found = member(owner.node, key);
    return reader.expect(found, type, key, [...owner.jsonPath, key]) ? found : undefined;
}

function readAll<T>(
    reader: Reader,
    root: ResolverNode,
    collection: "sets" | "modifiers",
    read: (reader: Reader, owner: ResolverNode, name: string) => T,
): Map<string, T> {
    const found = new Map<string, T>();
    const map = optional(reader, root, collection, "object");
    for (const { key, value } of map ? members(map) : []) {
        const jsonPath = [collection, key];
        if (reader.expect(value, "object", key, jsonPath)) {
            found.set(key, read(reader, { node: value, jsonPath }, key));
        }
    }
    return found;
}

function readSources(reader: Reader, list: ResolverNode, label: string): ResolverNode[] {
    return (list.node.children ?? []).flatMap((node, index) => {
        const jsonPath = [...list.jsonPath, index];
        return reader.expect(node, "object", `${label}[${index}]`, jsonPath)
            ? [{ node, jsonPath }]
            : [];
    });
}

export function readSetParts(reader: Reader, owner: ResolverNode): Partial<SetDefinition> {
    const description = optional(reader, owner, "description", "string");
    const extensions = optional(reader, owner, "$extensions", "object");
    const list = optional(reader, owner, "sources", "array");
    return {
        ...(description && { description: description.value }),
        ...(list && {
            sources: readSources(
                reader,
                { node: list, jsonPath: [...owner.jsonPath, "sources"] },
                "sources",
            ),
        }),
        ...(extensions && { extensions }),
    };
}

function readSet(
    reader: Reader,
    owner: ResolverNode,
    name: string,
    alsoKnown: readonly string[] = [],
): SetDefinition {
    reader.checkKeys(owner, "set", [...SET_KEYS, ...alsoKnown]);
    present(reader, owner, "sources");
    return { name, sources: [], declared: owner.node, ...readSetParts(reader, owner) };
}

function readModifierParts(
    reader: Reader,
    owner: ResolverNode,
    name: string,
): Partial<ModifierDefinition> {
    const description = optional(reader, owner, "description", "string");
    const extensions = optional(reader, owner, "$extensions", "object");
    const map = optional(reader, owner, "contexts", "object");
    const fallback = optional(reader, owner, "default", "string");

    let contexts: Map<string, ContextDefinition> | undefined;
    if (map) {
        const jsonPath = [...owner.jsonPath, "contexts"];
        const entries = members(map);
        if (entries.length === 0) reader.report({ rule: "no-contexts", name, jsonPath }, map);
        if (entries.length === 1) reader.report({ rule: "single-context", name, jsonPath }, map);
        contexts = new Map(
            entries.map(({ key, value }) => {
                const sourcesJsonPath = [...jsonPath, key];
                const list = reader.expect(value, "array", key, sourcesJsonPath);
                const sources = list
                    ? readSources(reader, { node: value, jsonPath: sourcesJsonPath }, key)
                    : [];
                return [key, { sources, declared: value }];
            }),
        );
    }
    return {
        ...(description && { description: description.value }),
        ...(contexts && { contexts }),
        ...(fallback && { default: fallback.value }),
        ...(extensions && { extensions }),
    };
}

function readModifier(
    reader: Reader,
    owner: ResolverNode,
    name: string,
    alsoKnown: readonly string[] = [],
): ModifierDefinition {
    reader.checkKeys(owner, "modifier", [...MODIFIER_KEYS, ...alsoKnown]);
    present(reader, owner, "contexts");
    return checkDefault(reader, owner, {
        name,
        contexts: new Map(),
        declared: owner.node,
        ...readModifierParts(reader, owner, name),
    });
}

function checkDefault(
    reader: Reader,
    owner: ResolverNode,
    modifier: ModifierDefinition,
): ModifierDefinition {
    if (modifier.default === undefined || modifier.contexts.has(modifier.default)) return modifier;
    const written = member(owner.node, "default");
    reader.report(
        {
            rule: "invalid-default",
            name: modifier.name,
            jsonPath: written ? [...owner.jsonPath, "default"] : owner.jsonPath,
        },
        written ?? owner.node,
    );
    const withoutDefault = { ...modifier };
    delete withoutDefault.default;
    return withoutDefault;
}

function readOrder(
    reader: Reader,
    root: ResolverNode,
    sets: Map<string, SetDefinition>,
    modifiers: Map<string, ModifierDefinition>,
): ResolverItem[] {
    const list = required(reader, root, "resolutionOrder", "array");
    const order: ResolverItem[] = [];
    const inlineNames = new Set<string>();
    const modifierNames = new Set<string>();

    for (const [index, node] of (list?.children ?? []).entries()) {
        const owner: ResolverNode = { node, jsonPath: ["resolutionOrder", index] };
        if (!reader.expect(node, "object", `resolutionOrder[${index}]`, owner.jsonPath)) continue;
        const item = member(node, "$ref")
            ? readOrderRef(reader, owner, sets, modifiers)
            : readInline(reader, owner, inlineNames);
        if (!item) continue;

        if (item.kind === "modifier") {
            const { name } = item.modifier;
            if (modifierNames.has(name)) {
                reader.report({ rule: "duplicate-name", name, jsonPath: owner.jsonPath }, node);
                continue;
            }
            modifierNames.add(name);
        }
        order.push(item);
    }
    return order;
}

function readOrderRef(
    reader: Reader,
    owner: ResolverNode,
    sets: Map<string, SetDefinition>,
    modifiers: Map<string, ModifierDefinition>,
): ResolverItem | undefined {
    const jsonPath = [...owner.jsonPath, "$ref"];
    const ref = member(owner.node, "$ref");
    if (!reader.expect(ref, "string", "$ref", jsonPath)) return undefined;

    const pointer = ref.value;
    if (!pointer.startsWith("#")) {
        reader.report({ rule: "file-in-resolution-order", name: pointer, jsonPath }, ref);
        return undefined;
    }
    const read = readPointerText(pointer);
    if (!read.ok) {
        const [collection, name, ...rest] = read.correctedSteps;
        const reaches =
            rest.length === 0 &&
            name !== undefined &&
            ((collection === "sets" && sets.has(name)) ||
                (collection === "modifiers" && modifiers.has(name)));
        reader.diagnose("malformed-pointer", malformedPointer(pointer, read, reaches), ref);
        return undefined;
    }
    const [collection, name, ...rest] = read.steps;
    if (name === undefined || rest.length > 0) {
        reader.report({ rule: "invalid-pointer", name: pointer, jsonPath }, ref);
        return undefined;
    }

    if (collection === "sets") {
        reader.checkKeys(owner, "set", ["$ref", ...SET_KEYS]);
        const set = sets.get(name);
        if (!set) reader.report({ rule: "unknown-set", name, jsonPath }, ref);
        return set && { kind: "set", set: { ...set, ...readSetParts(reader, owner) } };
    }
    if (collection === "modifiers") {
        reader.checkKeys(owner, "modifier", ["$ref", ...MODIFIER_KEYS]);
        const modifier = modifiers.get(name);
        if (!modifier) reader.report({ rule: "unknown-modifier", name, jsonPath }, ref);
        return (
            modifier && {
                kind: "modifier",
                modifier: checkDefault(reader, owner, {
                    ...modifier,
                    ...readModifierParts(reader, owner, name),
                }),
            }
        );
    }
    reader.report({ rule: "invalid-pointer", name: pointer, jsonPath }, ref);
    return undefined;
}

function readInline(
    reader: Reader,
    owner: ResolverNode,
    names: Set<string>,
): ResolverItem | undefined {
    const type = required(reader, owner, "type", "string");
    const nameNode = required(reader, owner, "name", "string");
    const kind = type?.value;
    if (type && kind !== undefined && kind !== "set" && kind !== "modifier") {
        reader.report(
            { rule: "unknown-item-type", name: kind, jsonPath: [...owner.jsonPath, "type"] },
            type,
        );
    }
    if (!nameNode) return undefined;

    const name = nameNode.value;
    if (names.has(name)) {
        reader.report(
            { rule: "duplicate-name", name, jsonPath: [...owner.jsonPath, "name"] },
            nameNode,
        );
        return undefined;
    }
    names.add(name);
    if (kind === "set") return { kind: "set", set: readSet(reader, owner, name, INLINE_KEYS) };
    if (kind === "modifier") {
        return { kind: "modifier", modifier: readModifier(reader, owner, name, INLINE_KEYS) };
    }
    return undefined;
}
