import type { Node } from "jsonc-parser";
import type { Resolver, ResolverModifier, ResolverSet, SourceRef } from "../model.js";
import { diagnostic, type Problems } from "./diagnostics.js";
import { member, plainObject, spanOf } from "./json.js";
import { folderOf } from "./paths.js";
import { encodePointer } from "./pointer.js";
import {
    type CheckedResolver,
    type ModifierDefinition,
    type SetDefinition,
    type ResolverNode,
    isStringNode,
} from "./resolver.js";
import { type SetsUsed, fragmentPointer, readSourceRef, setNamed } from "./sources.js";
import type { Building } from "./building.js";
import { linkedContext, linkedModifier } from "./linked.js";

export function resolverPart(
    resolver: CheckedResolver,
    setsUsed: SetsUsed,
    diagnostics: Problems,
): Resolver {
    const named = resolver.order.flatMap((item) => (item.kind === "set" ? [item.set] : []));
    const sets = new Map(named.map((set) => [set.name, set]));
    for (const reached of setsUsed.reached) {
        const set = resolver.sets.get(reached);
        if (set && !sets.has(reached)) sets.set(reached, set);
    }
    const modifiers = resolver.order.flatMap((item) =>
        item.kind === "modifier" ? [item.modifier] : [],
    );

    const reportUnused = (
        item: "set" | "modifier",
        declared: Map<string, { declared: Node }>,
        used: Set<string>,
    ) => {
        for (const [name, { declared: node }] of declared) {
            if (used.has(name)) continue;
            const span = spanOf(resolver.file, node);
            const detail = { item, name };
            diagnostics.found(
                diagnostic("not-in-resolution-order", detail, { span, tags: ["unnecessary"] }),
            );
        }
    };
    reportUnused("set", resolver.sets, new Set([...sets.keys(), ...setsUsed.pointedInto]));
    reportUnused("modifier", resolver.modifiers, new Set(modifiers.map(({ name }) => name)));

    const { file, version, name, description } = resolver;
    return {
        file: file.path,
        ...(version !== undefined && { version }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        sets: inWrittenOrder([...sets.values()]).map((set) => publicSet(resolver, set)),
        modifiers: inWrittenOrder(modifiers).map((each) => publicModifier(resolver, each)),
        resolutionOrder: resolver.order.map((item) =>
            item.kind === "set" ? { set: item.set.name } : { modifier: item.modifier.name },
        ),
    };
}

function publicSet(resolver: CheckedResolver, set: SetDefinition): ResolverSet {
    const extensions = set.extensions && plainObject(set.extensions);
    return {
        name: set.name,
        ...(set.description !== undefined && { description: set.description }),
        ...(extensions && { extensions }),
        sources: sourcesAsWritten(resolver, set.sources),
        span: spanOf(resolver.file, set.declared),
    };
}

function publicModifier(resolver: CheckedResolver, modifier: ModifierDefinition): ResolverModifier {
    const extensions = modifier.extensions && plainObject(modifier.extensions);
    const made: Building<ResolverModifier> = linkedModifier({
        name: modifier.name,
        ...(modifier.description !== undefined && { description: modifier.description }),
        ...(extensions && { extensions }),
        contexts: [],
        ...(modifier.default !== undefined && { default: modifier.default }),
        span: spanOf(resolver.file, modifier.declared),
    });
    made.contexts = [...modifier.contexts].map(([context, { sources, declared }]) =>
        linkedContext({
            name: context,
            modifier: made,
            sources: sourcesAsWritten(resolver, sources),
            isDefault: context === modifier.default,
            span: spanOf(resolver.file, declared),
        }),
    );
    return made;
}

function sourcesAsWritten(resolver: CheckedResolver, sources: ResolverNode[]): SourceRef[] {
    return sources.flatMap((source) => sourceAsWritten(resolver, source) ?? []);
}

function sourceAsWritten(resolver: CheckedResolver, source: ResolverNode): SourceRef | undefined {
    const { file } = resolver;
    const ref = member(source.node, "$ref");
    if (!ref) return { file: file.path, pointer: encodePointer(source.jsonPath) };
    if (!isStringNode(ref)) return undefined;
    const read = readSourceRef(folderOf(file.path), ref.value);
    if (read.kind === "malformed") return undefined;
    if (read.kind === "file") return { file: read.path, ...fragmentPointer(read.steps) };
    const set = setNamed(read.steps);
    if (set !== undefined) return resolver.sets.has(set) ? { set } : undefined;
    return { file: file.path, pointer: encodePointer(read.steps) };
}

function inWrittenOrder<T extends { declared: Node }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.declared.offset - b.declared.offset);
}
