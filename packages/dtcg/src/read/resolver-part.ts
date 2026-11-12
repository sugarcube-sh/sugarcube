import type { Node } from "jsonc-parser";
import type { Resolver, ResolverModifier, ResolverSet, SourceRef } from "../model.js";
import { diagnostic, type DiagnosticCollector } from "./diagnostics.js";
import { member, toPlainObject, toSpan } from "./json.js";
import { getFolder } from "./paths.js";
import { encodePointer } from "./pointer.js";
import {
    type CheckedResolver,
    type ModifierDefinition,
    type SetDefinition,
    type ResolverNode,
    isStringNode,
} from "./resolver.js";
import { type SetsUsed, fragmentPointer, parseSourceRef, parseSetName } from "./sources.js";
import type { Mutable } from "./building.js";
import { createContext, createModifier } from "./linked.js";

export function toPublicResolver(
    resolver: CheckedResolver,
    setsUsed: SetsUsed,
    diagnostics: DiagnosticCollector,
): Resolver {
    const named = resolver.resolutionOrder.flatMap((item) =>
        item.kind === "set" ? [item.set] : [],
    );
    const sets = new Map(named.map((set) => [set.name, set]));
    for (const reached of setsUsed.referenced) {
        const set = resolver.sets.get(reached);
        if (set && !sets.has(reached)) sets.set(reached, set);
    }
    const modifiers = resolver.resolutionOrder.flatMap((item) =>
        item.kind === "modifier" ? [item.modifier] : [],
    );

    const reportUnused = (
        item: "set" | "modifier",
        declared: Map<string, { declared: Node }>,
        used: Set<string>,
    ) => {
        for (const [name, { declared: node }] of declared) {
            if (used.has(name)) continue;
            const span = toSpan(resolver.file, node);
            const detail = { item, name };
            diagnostics.add(
                diagnostic("not-in-resolution-order", detail, { span, tags: ["unnecessary"] }),
            );
        }
    };
    reportUnused("set", resolver.sets, new Set([...sets.keys(), ...setsUsed.pointerTargets]));
    reportUnused("modifier", resolver.modifiers, new Set(modifiers.map(({ name }) => name)));

    const { file, version, name, description } = resolver;
    return {
        file: file.path,
        ...(version !== undefined && { version }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        sets: sortByDocumentOrder([...sets.values()]).map((set) => publicSet(resolver, set)),
        modifiers: sortByDocumentOrder(modifiers).map((each) => publicModifier(resolver, each)),
        resolutionOrder: resolver.resolutionOrder.map((item) =>
            item.kind === "set" ? { set: item.set.name } : { modifier: item.modifier.name },
        ),
    };
}

function publicSet(resolver: CheckedResolver, set: SetDefinition): ResolverSet {
    const extensions = set.extensions && toPlainObject(set.extensions);
    return {
        name: set.name,
        ...(set.description !== undefined && { description: set.description }),
        ...(extensions && { extensions }),
        sources: toSourceRefs(resolver, set.sources),
        span: toSpan(resolver.file, set.declared),
    };
}

function publicModifier(resolver: CheckedResolver, modifier: ModifierDefinition): ResolverModifier {
    const extensions = modifier.extensions && toPlainObject(modifier.extensions);
    const made: Mutable<ResolverModifier> = createModifier({
        name: modifier.name,
        ...(modifier.description !== undefined && { description: modifier.description }),
        ...(extensions && { extensions }),
        contexts: [],
        ...(modifier.default !== undefined && { default: modifier.default }),
        span: toSpan(resolver.file, modifier.declared),
    });
    made.contexts = [...modifier.contexts].map(([context, { sources, declared }]) =>
        createContext({
            name: context,
            modifier: made,
            sources: toSourceRefs(resolver, sources),
            isDefault: context === modifier.default,
            span: toSpan(resolver.file, declared),
        }),
    );
    return made;
}

function toSourceRefs(resolver: CheckedResolver, sources: ResolverNode[]): SourceRef[] {
    return sources.flatMap((source) => toSourceRef(resolver, source) ?? []);
}

function toSourceRef(resolver: CheckedResolver, source: ResolverNode): SourceRef | undefined {
    const { file } = resolver;
    const ref = member(source.node, "$ref");
    if (!ref) return { file: file.path, pointer: encodePointer(source.jsonPath) };
    if (!isStringNode(ref)) return undefined;
    const read = parseSourceRef(getFolder(file.path), ref.value);
    if (read.kind === "malformed") return undefined;
    if (read.kind === "file") return { file: read.path, ...fragmentPointer(read.steps) };
    const set = parseSetName(read.steps);
    if (set !== undefined) return resolver.sets.has(set) ? { set } : undefined;
    return { file: file.path, pointer: encodePointer(read.steps) };
}

function sortByDocumentOrder<T extends { declared: Node }>(items: T[]): T[] {
    return items.toSorted((a, b) => a.declared.offset - b.declared.offset);
}
