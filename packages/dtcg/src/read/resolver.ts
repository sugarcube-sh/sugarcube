import type { Node } from "jsonc-parser";
import type {
    Diagnostic,
    DiagnosticDetailByKind,
    DiagnosticKind,
    JsonPath,
    ResolverProblem,
} from "../index.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { type JsonFile, member, members, spanOf } from "./json.js";
import { malformedPointer } from "./malformed-pointer.js";
import { parsePointer, readPointerText } from "./pointer.js";
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

export interface SourceNode {
    node: Node;
    path: JsonPath;
}

export interface SetDefinition {
    name: string;
    sources: SourceNode[];
    extensions?: Node;
}

export interface ModifierDefinition {
    name: string;
    contexts: Map<string, SourceNode[]>;
    default?: string;
    extensions?: Node;
    declared: Node;
}

export type ResolverItem =
    | { kind: "set"; set: SetDefinition }
    | { kind: "modifier"; modifier: ModifierDefinition };

export interface Resolver {
    file: JsonFile;
    sets: Map<string, SetDefinition>;
    modifiers: Map<string, ModifierDefinition>;
    order: ResolverItem[];
}

type JsonType = "string" | "object" | "array";

export interface Reader {
    report(problem: ResolverProblem, node: Node, extra?: Omit<DiagnosticExtra, "at">): void;
    diagnose<K extends DiagnosticKind>(
        kind: K,
        detail: DiagnosticDetailByKind[K],
        node: Node,
        extra?: Omit<DiagnosticExtra, "at">,
    ): void;
    expect(node: Node | undefined, type: JsonType, name: string, at: JsonPath): node is Node;
    checkKeys(
        owner: Place,
        kind: Exclude<DiagnosticDetailByKind["unknown-property"], { at: JsonPath }>["owner"],
        known: readonly string[],
    ): void;
}

export interface Place {
    node: Node;
    path: JsonPath;
}

export function isResolver(root: Node): boolean {
    return members(root).some(
        ({ key, value }) =>
            key === "resolutionOrder" || (key === "version" && value.type === "string"),
    );
}

export function checkResolver(file: JsonFile, diagnostics: Diagnostic[]): Resolver {
    const reader = createReader(file, diagnostics);
    const root: Place = { node: file.root, path: [] };

    const version = member(root.node, "version");
    if (version?.type !== "string" || version.value !== "2025.10") {
        reader.report({ rule: "version", name: "version", at: ["version"] }, version ?? root.node);
    }
    optional(reader, root, "name", "string");
    optional(reader, root, "description", "string");
    reader.checkKeys(root, "resolver", ROOT_KEYS);

    const sets = readAll(reader, root, "sets", readSet);
    const modifiers = readAll(reader, root, "modifiers", readModifier);
    const order = readOrder(reader, root, sets, modifiers);
    return { file, sets, modifiers, order };
}

export function resolverProblem(
    file: JsonFile,
    problem: ResolverProblem,
    node: Node,
    extra: Omit<DiagnosticExtra, "at"> = {},
): Diagnostic {
    return diagnostic("resolver-invalid", problem, {
        ...extra,
        at: spanOf(file.path, file.lineStarts, node.offset, node.length),
    });
}

export function createReader(file: JsonFile, diagnostics: Diagnostic[]): Reader {
    const reader: Reader = {
        report: (problem, node, extra) =>
            diagnostics.push(resolverProblem(file, problem, node, extra)),
        diagnose: (kind, detail, node, extra = {}) => {
            const at = spanOf(file.path, file.lineStarts, node.offset, node.length);
            diagnostics.push(diagnostic(kind, detail, { ...extra, at }));
        },
        expect: (node, type, name, at): node is Node => {
            if (!node) return false;
            if (node.type === type) return true;
            reader.report({ rule: "wrong-type", name, at, expected: type }, node);
            return false;
        },
        checkKeys: (owner, kind, known) => {
            for (const { key, keyNode } of members(owner.node)) {
                if (known.includes(key)) continue;
                const similar = similarName(key, known);
                const at = spanOf(file.path, file.lineStarts, keyNode.offset, keyNode.length);
                const detail = {
                    property: key,
                    owner: kind,
                    ...(similar !== undefined && { similar }),
                };
                diagnostics.push(diagnostic("unknown-property", detail, { at }));
            }
        },
    };
    return reader;
}

function present(reader: Reader, owner: Place, key: string): Node | undefined {
    const found = member(owner.node, key);
    if (!found) reader.report({ rule: "missing-property", name: key, at: owner.path }, owner.node);
    return found;
}

function required(reader: Reader, owner: Place, key: string, type: JsonType): Node | undefined {
    const found = present(reader, owner, key);
    return reader.expect(found, type, key, [...owner.path, key]) ? found : undefined;
}

function optional(reader: Reader, owner: Place, key: string, type: JsonType): Node | undefined {
    const found = member(owner.node, key);
    return reader.expect(found, type, key, [...owner.path, key]) ? found : undefined;
}

function readAll<T>(
    reader: Reader,
    root: Place,
    collection: "sets" | "modifiers",
    read: (reader: Reader, owner: Place, name: string) => T,
): Map<string, T> {
    const found = new Map<string, T>();
    const map = optional(reader, root, collection, "object");
    for (const { key, value } of map ? members(map) : []) {
        const path = [collection, key];
        if (reader.expect(value, "object", key, path)) {
            found.set(key, read(reader, { node: value, path }, key));
        }
    }
    return found;
}

function readSources(reader: Reader, list: Place, label: string): SourceNode[] {
    return (list.node.children ?? []).flatMap((node, index) => {
        const path = [...list.path, index];
        return reader.expect(node, "object", `${label}[${index}]`, path) ? [{ node, path }] : [];
    });
}

export function readSetParts(reader: Reader, owner: Place): Partial<SetDefinition> {
    optional(reader, owner, "description", "string");
    const extensions = optional(reader, owner, "$extensions", "object");
    const list = optional(reader, owner, "sources", "array");
    return {
        ...(list && {
            sources: readSources(
                reader,
                { node: list, path: [...owner.path, "sources"] },
                "sources",
            ),
        }),
        ...(extensions && { extensions }),
    };
}

function readSet(
    reader: Reader,
    owner: Place,
    name: string,
    alsoKnown: readonly string[] = [],
): SetDefinition {
    reader.checkKeys(owner, "set", [...SET_KEYS, ...alsoKnown]);
    present(reader, owner, "sources");
    return { name, sources: [], ...readSetParts(reader, owner) };
}

function readModifierParts(
    reader: Reader,
    owner: Place,
    name: string,
): Partial<ModifierDefinition> {
    optional(reader, owner, "description", "string");
    const extensions = optional(reader, owner, "$extensions", "object");
    const map = optional(reader, owner, "contexts", "object");
    const fallback = optional(reader, owner, "default", "string");

    let contexts: Map<string, SourceNode[]> | undefined;
    if (map) {
        const at = [...owner.path, "contexts"];
        const entries = members(map);
        if (entries.length === 0) reader.report({ rule: "no-contexts", name, at }, map);
        if (entries.length === 1) reader.report({ rule: "single-context", name, at }, map);
        contexts = new Map(
            entries.map(({ key, value }) => {
                const path = [...at, key];
                const list = reader.expect(value, "array", key, path);
                return [key, list ? readSources(reader, { node: value, path }, key) : []];
            }),
        );
    }
    return {
        ...(contexts && { contexts }),
        ...(fallback && { default: fallback.value as string }),
        ...(extensions && { extensions }),
    };
}

function readModifier(
    reader: Reader,
    owner: Place,
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
    owner: Place,
    modifier: ModifierDefinition,
): ModifierDefinition {
    if (modifier.default === undefined || modifier.contexts.has(modifier.default)) return modifier;
    const written = member(owner.node, "default");
    reader.report(
        {
            rule: "invalid-default",
            name: modifier.name,
            at: written ? [...owner.path, "default"] : owner.path,
        },
        written ?? owner.node,
    );
    const withoutDefault = { ...modifier };
    delete withoutDefault.default;
    return withoutDefault;
}

function readOrder(
    reader: Reader,
    root: Place,
    sets: Map<string, SetDefinition>,
    modifiers: Map<string, ModifierDefinition>,
): ResolverItem[] {
    const list = required(reader, root, "resolutionOrder", "array");
    const order: ResolverItem[] = [];
    const inlineNames = new Set<string>();
    const modifierNames = new Set<string>();

    for (const [index, node] of (list?.children ?? []).entries()) {
        const owner = { node, path: ["resolutionOrder", index] };
        if (!reader.expect(node, "object", `resolutionOrder[${index}]`, owner.path)) continue;
        const item = member(node, "$ref")
            ? readOrderRef(reader, owner, sets, modifiers)
            : readInline(reader, owner, inlineNames);
        if (!item) continue;

        if (item.kind === "modifier") {
            const { name } = item.modifier;
            if (modifierNames.has(name)) {
                reader.report({ rule: "duplicate-name", name, at: owner.path }, node);
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
    owner: Place,
    sets: Map<string, SetDefinition>,
    modifiers: Map<string, ModifierDefinition>,
): ResolverItem | undefined {
    const at = [...owner.path, "$ref"];
    const ref = member(owner.node, "$ref");
    if (!reader.expect(ref, "string", "$ref", at)) return undefined;

    const pointer = ref.value as string;
    if (!pointer.startsWith("#")) {
        reader.report({ rule: "file-in-resolution-order", name: pointer, at }, ref);
        return undefined;
    }
    const read = readPointerText(pointer);
    if (!read.ok) {
        const [collection, name, ...rest] = parsePointer(read.corrected) ?? [];
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
        reader.report({ rule: "invalid-pointer", name: pointer, at }, ref);
        return undefined;
    }

    if (collection === "sets") {
        reader.checkKeys(owner, "set", ["$ref", ...SET_KEYS]);
        const set = sets.get(name);
        if (!set) reader.report({ rule: "unknown-set", name, at }, ref);
        return set && { kind: "set", set: { ...set, ...readSetParts(reader, owner) } };
    }
    if (collection === "modifiers") {
        reader.checkKeys(owner, "modifier", ["$ref", ...MODIFIER_KEYS]);
        const modifier = modifiers.get(name);
        if (!modifier) reader.report({ rule: "unknown-modifier", name, at }, ref);
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
    reader.report({ rule: "invalid-pointer", name: pointer, at }, ref);
    return undefined;
}

function readInline(reader: Reader, owner: Place, names: Set<string>): ResolverItem | undefined {
    const type = required(reader, owner, "type", "string");
    const nameNode = required(reader, owner, "name", "string");
    const kind = type?.value as string | undefined;
    if (type && kind !== undefined && kind !== "set" && kind !== "modifier") {
        reader.report({ rule: "unknown-item-type", name: kind, at: [...owner.path, "type"] }, type);
    }
    if (!nameNode) return undefined;

    const name = nameNode.value as string;
    if (names.has(name)) {
        reader.report({ rule: "duplicate-name", name, at: [...owner.path, "name"] }, nameNode);
        return undefined;
    }
    names.add(name);
    if (kind === "set") return { kind: "set", set: readSet(reader, owner, name, INLINE_KEYS) };
    if (kind === "modifier") {
        return { kind: "modifier", modifier: readModifier(reader, owner, name, INLINE_KEYS) };
    }
    return undefined;
}
