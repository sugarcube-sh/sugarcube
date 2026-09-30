import type { Node } from "jsonc-parser";
import type { Diagnostic, JsonPath, ResolverProblem } from "../index.js";
import { diagnostic } from "./diagnostics.js";
import { type JsonFile, member, members, spanOf } from "./json.js";
import { parsePointer } from "./pointer.js";

export interface Source {
    node: Node;
    path: JsonPath;
}

export interface SetDefinition {
    name: string;
    sources: Source[];
    extensions?: Node;
}

export interface ModifierDefinition {
    name: string;
    contexts: Map<string, Source[]>;
    default?: string;
    extensions?: Node;
}

export type OrderItem =
    | { kind: "set"; set: SetDefinition }
    | { kind: "modifier"; modifier: ModifierDefinition };

export interface Resolver {
    file: JsonFile;
    sets: Map<string, SetDefinition>;
    modifiers: Map<string, ModifierDefinition>;
    order: OrderItem[];
}

type JsonType = "string" | "object" | "array";

interface Reader {
    get(node: Node, key: string): Node | undefined;
    entries(node: Node): { key: string; value: Node }[];
    report(problem: ResolverProblem, node: Node): void;
    expect(node: Node | undefined, type: JsonType, name: string, at: JsonPath): node is Node;
}

interface Place {
    node: Node;
    path: JsonPath;
}

export function isResolver(root: Node): boolean {
    return members(root, new Set()).some(
        ({ key, value }) =>
            key === "resolutionOrder" || (key === "version" && value.type === "string"),
    );
}

export function readResolver(file: JsonFile, diagnostics: Diagnostic[]): Resolver {
    const reader = createReader(file, diagnostics);
    const root: Place = { node: file.root, path: [] };

    const version = reader.get(root.node, "version");
    if (version?.type !== "string" || version.value !== "2025.10") {
        reader.report({ rule: "version", name: "version", at: ["version"] }, version ?? root.node);
    }
    optional(reader, root, "name", "string");
    optional(reader, root, "description", "string");

    const sets = readAll(reader, root, "sets", readSet);
    const modifiers = readAll(reader, root, "modifiers", readModifier);
    const order = readOrder(reader, root, sets, modifiers);
    return { file, sets, modifiers, order };
}

function createReader(file: JsonFile, diagnostics: Diagnostic[]): Reader {
    const reader: Reader = {
        get: (node, key) => member(node, key, file.hidden),
        entries: (node) => members(node, file.hidden),
        report: (problem, node) =>
            diagnostics.push(
                diagnostic("resolver-invalid", problem, {
                    at: spanOf(file.path, file.lineStarts, node.offset, node.length),
                }),
            ),
        expect: (node, type, name, at): node is Node => {
            if (!node) return false;
            if (node.type === type) return true;
            reader.report({ rule: "wrong-type", name, at, expected: type }, node);
            return false;
        },
    };
    return reader;
}

function present(reader: Reader, owner: Place, key: string): Node | undefined {
    const found = reader.get(owner.node, key);
    if (!found) reader.report({ rule: "missing-property", name: key, at: owner.path }, owner.node);
    return found;
}

function required(reader: Reader, owner: Place, key: string, type: JsonType): Node | undefined {
    const found = present(reader, owner, key);
    return reader.expect(found, type, key, [...owner.path, key]) ? found : undefined;
}

function optional(reader: Reader, owner: Place, key: string, type: JsonType): Node | undefined {
    const found = reader.get(owner.node, key);
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
    for (const { key, value } of map ? reader.entries(map) : []) {
        const path = [collection, key];
        if (reader.expect(value, "object", key, path)) {
            found.set(key, read(reader, { node: value, path }, key));
        }
    }
    return found;
}

function readSources(reader: Reader, list: Place, label: string): Source[] {
    return (list.node.children ?? []).flatMap((node, index) => {
        const path = [...list.path, index];
        return reader.expect(node, "object", `${label}[${index}]`, path) ? [{ node, path }] : [];
    });
}

function readSetParts(reader: Reader, owner: Place): Partial<SetDefinition> {
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

function readSet(reader: Reader, owner: Place, name: string): SetDefinition {
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

    let contexts: Map<string, Source[]> | undefined;
    if (map) {
        const at = [...owner.path, "contexts"];
        const entries = reader.entries(map);
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

function readModifier(reader: Reader, owner: Place, name: string): ModifierDefinition {
    present(reader, owner, "contexts");
    return checkDefault(reader, owner, {
        name,
        contexts: new Map(),
        ...readModifierParts(reader, owner, name),
    });
}

function checkDefault(
    reader: Reader,
    owner: Place,
    modifier: ModifierDefinition,
): ModifierDefinition {
    if (modifier.default === undefined || modifier.contexts.has(modifier.default)) return modifier;
    const written = reader.get(owner.node, "default");
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
): OrderItem[] {
    const list = required(reader, root, "resolutionOrder", "array");
    const order: OrderItem[] = [];
    const inlineNames = new Set<string>();
    const modifierNames = new Set<string>();

    for (const [index, node] of (list?.children ?? []).entries()) {
        const owner = { node, path: ["resolutionOrder", index] };
        if (!reader.expect(node, "object", `resolutionOrder[${index}]`, owner.path)) continue;
        const item = reader.get(node, "$ref")
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
): OrderItem | undefined {
    const at = [...owner.path, "$ref"];
    const ref = reader.get(owner.node, "$ref");
    if (!reader.expect(ref, "string", "$ref", at)) return undefined;

    const pointer = ref.value as string;
    const steps = pointer.startsWith("#") ? parsePointer(pointer) : undefined;
    const [collection, name, ...rest] = steps ?? [];
    if (name === undefined || rest.length > 0) {
        reader.report({ rule: "invalid-pointer", name: pointer, at }, ref);
        return undefined;
    }

    if (collection === "sets") {
        const set = sets.get(name);
        if (!set) reader.report({ rule: "unknown-set", name, at }, ref);
        return set && { kind: "set", set: { ...set, ...readSetParts(reader, owner) } };
    }
    if (collection === "modifiers") {
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

function readInline(reader: Reader, owner: Place, names: Set<string>): OrderItem | undefined {
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
    if (kind === "set") return { kind: "set", set: readSet(reader, owner, name) };
    if (kind === "modifier") {
        return { kind: "modifier", modifier: readModifier(reader, owner, name) };
    }
    return undefined;
}
