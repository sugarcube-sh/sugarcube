import type { Problems } from "./diagnostics.js";
import type { Node } from "jsonc-parser";
import type { JsonPath } from "../model.js";
import { type Files, openFile, parseFile } from "./files.js";
import { type JsonFile, member, members, toSpan } from "./json.js";
import { malformedPointer } from "./malformed-pointer.js";
import { getFolder, join } from "./paths.js";
import { type PointerReading, encodePointer, follow, readPointerText } from "./pointer.js";
import {
    type ModifierDefinition,
    type Reader,
    type CheckedResolver,
    type SetDefinition,
    type ResolverNode,
    type StringNode,
    createReader,
    isResolver,
    SET_KEYS,
    readSetParts,
    resolverProblem,
} from "./resolver.js";

export interface RouteStep {
    name: string;
    extensions?: Node;
}

export type SourcePiece =
    | {
          kind: "inline";
          node: Node;
          jsonPath: JsonPath;
          route: RouteStep[];
          overriddenKeys?: string[];
      }
    | {
          kind: "file";
          path: string;
          fragment: string[];
          ref: StringNode;
          jsonPath: JsonPath;
          route: RouteStep[];
          overriddenKeys?: string[];
      };

export interface SourceEntry {
    pieces: readonly SourcePiece[];
}

export type ExpandedItem =
    | { kind: "set"; set: SetDefinition; entries: SourceEntry[] }
    | { kind: "modifier"; modifier: ModifierDefinition; contexts: Map<string, SourceEntry[]> };

export interface LoadedSource {
    file: string;
    pointer?: string;
    json?: JsonFile;
    tree?: Node;
    overriddenKeys?: string[];
}

export interface SetsUsed {
    reached: Set<string>;
    pointedInto: Set<string>;
}

export function expandSources(
    resolver: CheckedResolver,
    diagnostics: Problems,
): { items: ExpandedItem[]; setsUsed: SetsUsed } {
    const setsUsed: SetsUsed = { reached: new Set(), pointedInto: new Set() };
    const expander: Expander = {
        reader: createReader(resolver.file, diagnostics),
        root: resolver.file.root,
        folder: getFolder(resolver.file.path),
        sets: resolver.sets,
        expanded: new Map(),
        setsUsed,
    };
    const expand = (sources: ResolverNode[], route: RouteStep[]) =>
        expandList(expander, sources, route, []);
    const items = resolver.resolutionOrder.map((item): ExpandedItem =>
        item.kind === "set"
            ? {
                  kind: "set",
                  set: item.set,
                  entries: expand(item.set.sources, [toRouteStep(item.set)]),
              }
            : {
                  kind: "modifier",
                  modifier: item.modifier,
                  contexts: new Map(
                      [...item.modifier.contexts].map(([context, { sources }]) => [
                          context,
                          expand(sources, []),
                      ]),
                  ),
              },
    );
    return { items, setsUsed };
}

function allEntries(items: ExpandedItem[]): SourceEntry[] {
    return items.flatMap((item) =>
        item.kind === "set" ? item.entries : [...item.contexts.values()].flat(),
    );
}

export function allPieces(items: ExpandedItem[]): SourcePiece[] {
    return allEntries(items).flatMap(({ pieces }) => pieces);
}

export function allFiles(pieces: SourcePiece[]): string[] {
    return pieces.flatMap((piece) => (piece.kind === "file" ? [piece.path] : []));
}

export function openSources(
    files: Files,
    resolver: CheckedResolver,
    pieces: SourcePiece[],
): Map<SourcePiece, LoadedSource> {
    return new Map(pieces.map((piece) => [piece, openSource(files, resolver, piece)]));
}

function openSource(files: Files, resolver: CheckedResolver, piece: SourcePiece): LoadedSource {
    const overridden = piece.overriddenKeys && { overriddenKeys: piece.overriddenKeys };
    if (piece.kind === "inline") {
        return {
            file: resolver.file.path,
            pointer: encodePointer(piece.jsonPath),
            json: resolver.file,
            tree: piece.node,
            ...overridden,
        };
    }

    const { path } = piece;
    const pointer = fragmentPointer(piece.fragment);
    const refText = piece.ref.value;
    const jsonPath = [...piece.jsonPath, "$ref"];
    const report = (problem: Parameters<typeof resolverProblem>[1]) =>
        files.diagnostics.found(resolverProblem(resolver.file, problem, piece.ref));

    const root = parseFile(files, path)?.root;
    if (isResolver(path, root)) {
        openFile(files, path, "resolver");
        report({ rule: "resolver-as-source", name: path, jsonPath });
        return { file: path, ...pointer };
    }

    const json = openFile(files, path, "tokens", {
        file: resolver.file.path,
        span: toSpan(resolver.file, piece.ref),
    });
    if (!json) return { file: path, ...pointer };

    const followed = follow(json.root, piece.fragment);
    if (!followed.ok) {
        report({ rule: "invalid-pointer", name: refText, jsonPath });
        return { file: path, ...pointer };
    }
    if (followed.node.type !== "object") {
        report({ rule: "wrong-type", name: refText, jsonPath, expected: "object" });
        return { file: path, ...pointer };
    }
    return { file: path, ...pointer, json, tree: followed.node, ...overridden };
}

interface Expander {
    reader: Reader;
    root: Node;
    folder: string;
    sets: Map<string, SetDefinition>;
    expanded: Map<Node, Map<string, SourceEntry[]>>;
    setsUsed: SetsUsed;
}

function expandList(
    expander: Expander,
    sources: ResolverNode[],
    route: RouteStep[],
    seen: string[],
): SourceEntry[] {
    return sources.flatMap((source) => expandSource(expander, source, route, seen));
}

function expandSource(
    expander: Expander,
    source: ResolverNode,
    route: RouteStep[],
    seen: string[],
): SourceEntry[] {
    const byRoute = expander.expanded.get(source.node) ?? new Map<string, SourceEntry[]>();
    expander.expanded.set(source.node, byRoute);
    const key = route
        .map(({ name, extensions }) => `${name}@${extensions?.offset ?? ""}`)
        .join(" ");
    const cached = byRoute.get(key);
    if (cached) return cached;
    const entries = followSource(expander, source, route, seen);
    byRoute.set(key, entries);
    return entries;
}

function followSource(
    expander: Expander,
    source: ResolverNode,
    route: RouteStep[],
    seen: string[],
    pointedFrom: ResolverNode[] = [],
): SourceEntry[] {
    const { reader, root, folder, sets, setsUsed } = expander;
    const refNode = member(source.node, "$ref");
    if (!refNode) {
        return [
            { pieces: [{ kind: "inline", node: source.node, jsonPath: source.jsonPath, route }] },
        ];
    }

    const jsonPath = [...source.jsonPath, "$ref"];
    if (!reader.expect(refNode, "string", "$ref", jsonPath)) return [];
    const ref = refNode.value;
    const overriding = [source, ...pointedFrom];

    const read = readSourceRef(folder, ref);
    if (read.kind === "malformed") {
        const { failed, file } = read;
        const steps = failed.correctedSteps;
        const reaches = file !== undefined || (pointable(steps) && follow(root, steps).ok);
        const corrected = `${file ?? ""}${failed.corrected}`;
        reader.diagnose(
            "malformed-pointer",
            malformedPointer(ref, { ...failed, corrected }, reaches),
            refNode,
        );
        return [];
    }
    if (read.kind === "file") {
        const piece: SourcePiece = {
            kind: "file",
            path: read.path,
            fragment: read.steps,
            ref: refNode,
            jsonPath: source.jsonPath,
            route,
        };
        return withOverrides([{ pieces: [piece] }], overriding, route);
    }

    const { steps } = read;
    if (!pointable(steps)) {
        reader.report({ rule: "invalid-pointer", name: ref, jsonPath }, refNode);
        return [];
    }
    if (seen.includes(ref)) {
        reader.report({ rule: "circular-reference", name: ref, jsonPath }, refNode);
        return [];
    }

    const name = setNamed(steps);
    if (name !== undefined) {
        const target = sets.get(name);
        if (!target) {
            reader.report({ rule: "unknown-set", name, jsonPath }, refNode);
            return [];
        }
        setsUsed.reached.add(name);
        for (const each of overriding) reader.checkKeys(each, "set", ["$ref", ...SET_KEYS]);
        const set = overriding.some((each) => keysBeside(each).length > 0)
            ? Object.assign({ ...target }, ...overriding.map((each) => readSetParts(reader, each)))
            : target;
        return expandList(expander, set.sources, [...route, toRouteStep(set)], [...seen, ref]);
    }

    const followed = follow(root, steps);
    if (!followed.ok) {
        reader.report({ rule: "invalid-pointer", name: ref, jsonPath }, refNode);
        return [];
    }
    const [collection, inside] = steps;
    if (collection === "sets" && inside !== undefined) setsUsed.pointedInto.add(inside);
    if (!reader.expect(followed.node, "object", ref, jsonPath)) return [];
    const target = { node: followed.node, jsonPath: steps };
    if (member(target.node, "$ref")) {
        return followSource(expander, target, route, [...seen, ref], overriding);
    }
    const entries = expandSource(expander, target, route, [...seen, ref]);
    return withOverrides(entries, overriding, route);
}

function toRouteStep({ name, extensions }: SetDefinition): RouteStep {
    return { name, ...(extensions && { extensions }) };
}

export function setNamed(steps: string[]): string | undefined {
    const [collection, name, ...rest] = steps;
    return collection === "sets" && name !== undefined && rest.length === 0 ? name : undefined;
}

export type RefRead =
    | { kind: "file"; path: string; steps: string[] }
    | { kind: "pointer"; steps: string[] }
    | { kind: "malformed"; failed: Extract<PointerReading, { ok: false }>; file?: string };

export function readSourceRef(folder: string, ref: string): RefRead {
    if (ref.startsWith("#")) {
        const read = readPointerText(ref);
        return read.ok
            ? { kind: "pointer", steps: read.steps }
            : { kind: "malformed", failed: read };
    }
    const hash = ref.indexOf("#");
    const file = hash === -1 ? ref : ref.slice(0, hash);
    const path = join(folder, file);
    const fragment = hash === -1 ? "" : ref.slice(hash + 1);
    if (fragment === "") return { kind: "file", path, steps: [] };
    const read = readPointerText(`#${fragment}`);
    return read.ok
        ? { kind: "file", path, steps: read.steps }
        : { kind: "malformed", failed: read, file };
}

export function fragmentPointer(steps: string[]): { pointer?: string } {
    return steps.length > 0 ? { pointer: encodePointer(steps) } : {};
}

function keysBeside(source: ResolverNode): string[] {
    return members(source.node)
        .map(({ key }) => key)
        .filter((key) => key !== "$ref");
}

function withOverrides(
    entries: SourceEntry[],
    overriding: ResolverNode[],
    route: RouteStep[],
): SourceEntry[] {
    return overriding.reduce((inner, source) => withOverride(inner, source, route), entries);
}

function withOverride(
    entries: SourceEntry[],
    source: ResolverNode,
    route: RouteStep[],
): SourceEntry[] {
    const overridden = keysBeside(source);
    if (overridden.length === 0) return entries;
    const overriddenPieces = entries.flatMap(({ pieces }) =>
        pieces.map((piece) => ({
            ...piece,
            overriddenKeys: [...(piece.overriddenKeys ?? []), ...overridden],
        })),
    );
    const beside: SourcePiece = {
        kind: "inline",
        node: source.node,
        jsonPath: source.jsonPath,
        route,
        overriddenKeys: ["$ref"],
    };
    return [{ pieces: [...overriddenPieces, beside] }];
}

function pointable([first]: string[]): boolean {
    return first !== "modifiers" && first !== "resolutionOrder";
}
