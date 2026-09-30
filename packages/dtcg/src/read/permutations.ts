import type { Input, SetRef } from "../index.js";
import { type JsonFile, plainValue } from "./json.js";
import type { Resolver, SetDefinition } from "./resolver.js";
import type { ExpandedItem, LoadedSource, SourceEntry } from "./sources.js";

export interface LoadedPermutation {
    input: Input;
    label: string;
    sources: { ref: SetRef; source: LoadedSource }[];
}

export interface Permutations {
    modifiers: Record<string, { contexts: string[]; default?: string }>;
    readers: Record<string, "everyone" | Input[]>;
    permutations: LoadedPermutation[];
}

export function fromTokenFiles(files: { path: string; json?: JsonFile }[]): Permutations {
    return {
        modifiers: {},
        readers: Object.fromEntries(files.map(({ path }) => [path, "everyone"])),
        permutations: [
            {
                input: {},
                label: "default",
                sources: files.map(({ path, json }) => ({
                    ref: { file: path, from: { set: "default" } },
                    source: { file: path, ...(json && { json, tree: json.root }) },
                })),
            },
        ],
    };
}

export function fromResolver(
    resolver: Resolver,
    items: ExpandedItem[],
    sources: Map<SourceEntry, LoadedSource>,
): Permutations {
    const modifiers: Permutations["modifiers"] = {};
    for (const item of items) {
        if (item.kind !== "modifier") continue;
        const { name, contexts, default: fallback } = item.modifier;
        modifiers[name] = {
            contexts: [...contexts.keys()],
            ...(fallback !== undefined && { default: fallback }),
        };
    }
    if (Object.keys(modifiers).length > 0) return { modifiers, readers: {}, permutations: [] };

    const readers: Permutations["readers"] = {};
    const permutation: LoadedPermutation = { input: {}, label: "default", sources: [] };
    for (const item of items) {
        if (item.kind !== "set") continue;
        for (const entry of item.entries) {
            const source = sources.get(entry);
            if (!source) continue;
            readers[source.file] = "everyone";
            permutation.sources.push({
                ref: setRef(resolver, source, { set: item.set.name }, entry.holder),
                source,
            });
        }
    }
    return { modifiers, readers, permutations: [permutation] };
}

function setRef(
    resolver: Resolver,
    source: LoadedSource,
    from: SetRef["from"],
    holder: SetDefinition | undefined,
): SetRef {
    const extensions = holder?.extensions
        ? (plainValue(holder.extensions, resolver.file.hidden) as Record<string, unknown>)
        : undefined;
    return {
        file: source.file,
        ...(source.pointer && { pointer: source.pointer }),
        from,
        ...(extensions && { extensions }),
    };
}
