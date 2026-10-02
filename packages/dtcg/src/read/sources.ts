import type { Node } from "jsonc-parser";
import type { Diagnostic, JsonPath } from "../index.js";
import { type Files, openFile, parseFile } from "./files.js";
import { type JsonFile, spanOf } from "./json.js";
import { folderOf, join } from "./paths.js";
import { encodePointer, follow, parsePointer } from "./pointer.js";
import {
    type ModifierDefinition,
    type Reader,
    type Resolver,
    type SetDefinition,
    type SourceNode,
    createReader,
    isResolver,
    readSetParts,
    resolverProblem,
} from "./resolver.js";

export type SourceEntry =
    | {
          kind: "inline";
          node: Node;
          path: JsonPath;
          holder?: SetDefinition;
          overriddenKeys?: string[];
          layers?: SourceEntry[];
      }
    | {
          kind: "file";
          file: string;
          fragment: string[];
          ref: Node;
          path: JsonPath;
          holder?: SetDefinition;
          overriddenKeys?: string[];
          layers?: SourceEntry[];
      };

export type ExpandedItem =
    | { kind: "set"; set: SetDefinition; entries: SourceEntry[] }
    | { kind: "modifier"; modifier: ModifierDefinition; contexts: Map<string, SourceEntry[]> };

export interface LoadedSource {
    file: string;
    pointer?: string;
    json?: JsonFile;
    tree?: Node;
    overriddenKeys?: string[];
    layers?: LoadedSource[];
}

export function expandSources(resolver: Resolver, diagnostics: Diagnostic[]): ExpandedItem[] {
    const expander: Expander = {
        reader: createReader(resolver.file, diagnostics),
        root: resolver.file.root,
        sets: resolver.sets,
        expanded: new Map(),
    };
    const expand = (sources: SourceNode[], holder?: SetDefinition) =>
        expandList(expander, sources, holder, []);
    return resolver.order.map((item): ExpandedItem =>
        item.kind === "set"
            ? { kind: "set", set: item.set, entries: expand(item.set.sources, item.set) }
            : {
                  kind: "modifier",
                  modifier: item.modifier,
                  contexts: new Map(
                      [...item.modifier.contexts].map(([context, sources]) => [
                          context,
                          expand(sources),
                      ]),
                  ),
              },
    );
}

export function entriesOf(items: ExpandedItem[]): SourceEntry[] {
    return items.flatMap((item) =>
        item.kind === "set" ? item.entries : [...item.contexts.values()].flat(),
    );
}

export function filesNamedBy(resolver: Resolver, entries: SourceEntry[]): string[] {
    const folder = folderOf(resolver.file.path);
    return entries.flatMap((entry) => (entry.kind === "file" ? [join(folder, entry.file)] : []));
}

export function openSources(
    files: Files,
    resolver: Resolver,
    entries: SourceEntry[],
): Map<SourceEntry, LoadedSource> {
    const opened = new Map(entries.map((entry) => [entry, openSource(files, resolver, entry)]));
    for (const [entry, loaded] of opened) {
        if (entry.layers) loaded.layers = entry.layers.flatMap((each) => opened.get(each) ?? []);
    }
    return opened;
}

function openSource(files: Files, resolver: Resolver, entry: SourceEntry): LoadedSource {
    const overridden = entry.overriddenKeys && { overriddenKeys: entry.overriddenKeys };
    if (entry.kind === "inline") {
        return {
            file: resolver.file.path,
            pointer: encodePointer(entry.path),
            json: resolver.file,
            tree: entry.node,
            ...overridden,
        };
    }

    const path = join(folderOf(resolver.file.path), entry.file);
    const pointer = entry.fragment.length > 0 ? { pointer: encodePointer(entry.fragment) } : {};
    const refText = entry.ref.value as string;
    const at = [...entry.path, "$ref"];
    const report = (problem: Parameters<typeof resolverProblem>[1]) =>
        files.diagnostics.push(resolverProblem(resolver.file, problem, entry.ref));

    const root = parseFile(files, path)?.root;
    if (root && isResolver(root)) {
        openFile(files, path, "resolver");
        report({ rule: "resolver-as-source", name: path, at });
        return { file: path, ...pointer };
    }

    const json = openFile(files, path, "tokens", {
        file: resolver.file.path,
        at: spanOf(
            resolver.file.path,
            resolver.file.lineStarts,
            entry.ref.offset,
            entry.ref.length,
        ),
    });
    if (!json) return { file: path, ...pointer };

    const followed = follow(json.root, entry.fragment);
    if (!followed.ok) {
        report({ rule: "invalid-pointer", name: refText, at });
        return { file: path, ...pointer };
    }
    if (followed.node.type !== "object") {
        report({ rule: "wrong-type", name: refText, at, expected: "object" });
        return { file: path, ...pointer };
    }
    return { file: path, ...pointer, json, tree: followed.node, ...overridden };
}

interface Expander {
    reader: Reader;
    root: Node;
    sets: Map<string, SetDefinition>;
    expanded: Map<Node, Map<SetDefinition | undefined, SourceEntry[]>>;
}

function expandList(
    expander: Expander,
    sources: SourceNode[],
    holder: SetDefinition | undefined,
    seen: string[],
): SourceEntry[] {
    return sources.flatMap((source) => expandSource(expander, source, holder, seen));
}

function expandSource(
    expander: Expander,
    source: SourceNode,
    holder: SetDefinition | undefined,
    seen: string[],
): SourceEntry[] {
    const byHolder = expander.expanded.get(source.node) ?? new Map();
    expander.expanded.set(source.node, byHolder);
    const cached = byHolder.get(holder);
    if (cached) return cached;
    const entries = followSource(expander, source, holder, seen);
    byHolder.set(holder, entries);
    return entries;
}

function followSource(
    expander: Expander,
    source: SourceNode,
    holder: SetDefinition | undefined,
    seen: string[],
): SourceEntry[] {
    const { reader, root, sets } = expander;
    const refNode = reader.get(source.node, "$ref");
    if (!refNode) return [{ kind: "inline", node: source.node, path: source.path, holder }];

    const at = [...source.path, "$ref"];
    if (!reader.expect(refNode, "string", "$ref", at)) return [];
    const ref = refNode.value as string;
    const overridden = reader
        .entries(source.node)
        .map(({ key }) => key)
        .filter((key) => key !== "$ref");

    if (!ref.startsWith("#")) {
        const hash = ref.indexOf("#");
        const fragment = hash === -1 ? "" : ref.slice(hash + 1);
        const file = hash === -1 ? ref : ref.slice(0, hash);
        const steps =
            fragment === ""
                ? []
                : parsePointer(fragment.startsWith("/") ? `#${fragment}` : `#/${fragment}`);
        if (!steps) {
            reader.report({ rule: "invalid-pointer", name: ref, at }, refNode);
            return [];
        }
        const entry: SourceEntry = {
            kind: "file",
            file,
            fragment: steps,
            ref: refNode,
            path: source.path,
            holder,
        };
        return withOverride([entry], source, holder, overridden);
    }

    const steps = parsePointer(ref);
    if (!steps || steps[0] === "modifiers" || steps[0] === "resolutionOrder") {
        reader.report({ rule: "invalid-pointer", name: ref, at }, refNode);
        return [];
    }
    if (seen.includes(ref)) {
        reader.report({ rule: "circular-reference", name: ref, at }, refNode);
        return [];
    }

    const [collection, name, ...rest] = steps;
    if (collection === "sets" && name !== undefined && rest.length === 0) {
        const target = sets.get(name);
        if (!target) {
            reader.report({ rule: "unknown-set", name, at }, refNode);
            return [];
        }
        const set = overridden.length > 0 ? { ...target, ...readSetParts(reader, source) } : target;
        return expandList(expander, set.sources, set, [...seen, ref]);
    }

    const followed = follow(root, steps);
    if (!followed.ok) {
        reader.report({ rule: "invalid-pointer", name: ref, at }, refNode);
        return [];
    }
    if (!reader.expect(followed.node, "object", ref, at)) return [];
    const target = { node: followed.node, path: steps };
    return withOverride(
        expandSource(expander, target, holder, [...seen, ref]),
        source,
        holder,
        overridden,
    );
}

function withOverride(
    entries: SourceEntry[],
    source: SourceNode,
    holder: SetDefinition | undefined,
    overridden: string[],
): SourceEntry[] {
    if (overridden.length === 0) return entries;
    const layers: SourceEntry[] = [
        ...entries.map((entry) => ({
            ...entry,
            overriddenKeys: [...(entry.overriddenKeys ?? []), ...overridden],
        })),
        { kind: "inline", node: source.node, path: source.path, holder, overriddenKeys: ["$ref"] },
    ];
    for (const layer of layers) layer.layers = layers;
    return layers;
}
