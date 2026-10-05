import type { Node } from "jsonc-parser";
import type { Diagnostic, DiagnosticDetailByKind, Input, Source } from "../index.js";
import { diagnostic } from "./diagnostics.js";
import { type JsonFile, plainObject, spanOf } from "./json.js";
import type { Resolver } from "./resolver.js";
import type { Loaded } from "./load.js";
import type { ExpandedItem, LoadedSource, SourceEntry } from "./sources.js";

export interface LoadedPermutation {
    input: Input;
    label: string;
    sources: {
        source: Omit<Source, "extensions">;
        pieces: LoadedSource[];
        extensionsOfSet?: Record<string, unknown>;
    }[];
}

type Built = Pick<Loaded, "modifiers" | "usedBy" | "permutations">;

export interface PermutationOptions {
    inputs?: Record<string, unknown>[];
    permutations: "all" | "each-context";
    limit: number;
}

interface Modifier {
    name: string;
    contexts: string[];
    default?: string;
    declared: Node;
}

export function fromTokenFiles(files: { path: string; json?: JsonFile }[]): Built {
    return {
        modifiers: {},
        usedBy: Object.fromEntries(files.map(({ path }) => [path, "everyone"])),
        permutations: [
            {
                input: {},
                label: "default",
                sources: files.map(({ path, json }) => ({
                    source: { file: path },
                    pieces: [{ file: path, ...(json && { json, tree: json.root }) }],
                })),
            },
        ],
    };
}

export function fromResolver(
    resolver: Resolver,
    items: ExpandedItem[],
    sources: Map<SourceEntry, LoadedSource>,
    options: PermutationOptions,
    diagnostics: Diagnostic[],
): Built {
    const modifiers = modifiersOf(items);
    const inputs = chooseInputs(modifiers, options, { diagnostics, file: resolver.file });
    const labels = labelsFor(modifiers);
    return {
        modifiers: Object.fromEntries(
            modifiers.map(({ name, contexts, default: fallback }) => [
                name,
                { contexts, ...(fallback !== undefined && { default: fallback }) },
            ]),
        ),
        usedBy: whoUsesEachFile(items, sources),
        permutations: inputs.map((input) => ({
            input,
            label: labels(input),
            sources: sourcesFor(resolver, items, sources, input),
        })),
    };
}

function modifiersOf(items: ExpandedItem[]): Modifier[] {
    return items.flatMap((item) =>
        item.kind === "modifier"
            ? [
                  {
                      name: item.modifier.name,
                      contexts: [...item.contexts.keys()],
                      declared: item.modifier.declared,
                      ...(item.modifier.default !== undefined && {
                          default: item.modifier.default,
                      }),
                  },
              ]
            : [],
    );
}

interface Reporting {
    diagnostics: Diagnostic[];
    file: JsonFile;
}

function chooseInputs(
    modifiers: Modifier[],
    { inputs, permutations, limit }: PermutationOptions,
    reporting: Reporting,
): Input[] {
    const { diagnostics } = reporting;
    if (modifiers.length === 0) return [{}];
    const chosen = inputs
        ? inputs.flatMap((raw, index) => {
              const input = checkInput(modifiers, raw, index, diagnostics);
              return input ? [input] : [];
          })
        : permutations === "each-context"
          ? eachContext(modifiers, reporting)
          : allCombinations(modifiers, limit, reporting);
    const seen = new Set<string>();
    return chosen.filter((input) => {
        const key = inputKey(modifiers, input);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function inputKey(modifiers: Modifier[], input: Input): string {
    return JSON.stringify(modifiers.map(({ name }) => input[name]));
}

function checkInput(
    modifiers: Modifier[],
    raw: Record<string, unknown>,
    index: number,
    diagnostics: Diagnostic[],
): Input | undefined {
    const problems: Diagnostic[] = [];
    const chosen: Input = {};
    const mentioned = new Set<Modifier>();
    const invalid = (detail: Omit<DiagnosticDetailByKind["input-invalid"], "input">) =>
        problems.push(diagnostic("input-invalid", { ...detail, input: index }));

    for (const [key, value] of Object.entries(raw)) {
        const modifier = findByName(modifiers, key, ({ name }) => name);
        if (!modifier) {
            invalid({
                reason: "unknown-modifier",
                modifier: key,
                valid: modifiers.map(({ name }) => name),
            });
            continue;
        }
        mentioned.add(modifier);
        if (typeof value !== "string") {
            invalid({ reason: "not-a-string", modifier: modifier.name });
            continue;
        }
        const context = findByName(modifier.contexts, value, (each) => each);
        if (context === undefined) {
            invalid({
                reason: "unknown-context",
                modifier: modifier.name,
                context: value,
                valid: modifier.contexts,
            });
            continue;
        }
        chosen[modifier.name] = context;
    }

    for (const modifier of modifiers) {
        if (mentioned.has(modifier) || modifier.default !== undefined) continue;
        invalid({ reason: "missing-modifier", modifier: modifier.name, valid: modifier.contexts });
    }

    diagnostics.push(...problems);
    return problems.length === 0 ? withDefaults(modifiers, chosen) : undefined;
}

export function findByName<T>(
    candidates: T[],
    wanted: string,
    nameOf: (candidate: T) => string,
): T | undefined {
    const exact = candidates.find((candidate) => nameOf(candidate) === wanted);
    if (exact !== undefined) return exact;
    const folded = candidates.filter(
        (candidate) => nameOf(candidate).toLowerCase() === wanted.toLowerCase(),
    );
    return folded.length === 1 ? folded[0] : undefined;
}

function allCombinations(modifiers: Modifier[], limit: number, reporting: Reporting): Input[] {
    const count = modifiers.reduce((product, { contexts }) => product * contexts.length, 1);
    if (count <= limit) {
        const every = modifiers.reduce<Input[]>(
            (inputs, { name, contexts }) =>
                inputs.flatMap((input) =>
                    contexts.map((context) => ({ ...input, [name]: context })),
                ),
            [{}],
        );
        const defaults = hasDefaults(modifiers) ? [withDefaults(modifiers, {})] : [];
        return [...defaults, ...every];
    }
    const built = eachContext(modifiers, reporting);
    reporting.diagnostics.push(
        diagnostic("permutation-limit", { count, limit, built: built.length }),
    );
    return built;
}

function eachContext(modifiers: Modifier[], { diagnostics, file }: Reporting): Input[] {
    const withoutDefault = modifiers.filter(({ default: fallback }) => fallback === undefined);
    const [first] = withoutDefault;
    if (first) {
        const { offset, length } = first.declared;
        diagnostics.push(
            diagnostic(
                "no-default",
                { modifiers: withoutDefault.map(({ name }) => name) },
                { at: spanOf(file.path, file.lineStarts, offset, length) },
            ),
        );
    }
    const defaults = withoutDefault.length === 0 ? [withDefaults(modifiers, {})] : [];
    const singles = modifiers.flatMap((modifier) =>
        hasDefaults(modifiers.filter((other) => other !== modifier))
            ? modifier.contexts
                  .filter((context) => context !== modifier.default)
                  .map((context) => withDefaults(modifiers, { [modifier.name]: context }))
            : [],
    );
    return [...defaults, ...singles];
}

function hasDefaults(modifiers: Modifier[]): boolean {
    return modifiers.every((modifier) => modifier.default !== undefined);
}

function withDefaults(modifiers: Modifier[], chosen: Input): Input {
    const input: Input = {};
    for (const { name, default: fallback } of modifiers) {
        const context = chosen[name] ?? fallback;
        if (context !== undefined) input[name] = context;
    }
    return input;
}

function labelsFor(modifiers: Modifier[]): (input: Input) => string {
    const counts = new Map<string, number>();
    for (const { contexts } of modifiers) {
        for (const context of contexts) counts.set(context, (counts.get(context) ?? 0) + 1);
    }
    return (input) => {
        const parts = modifiers.flatMap(({ name, default: fallback }) => {
            const context = input[name];
            if (context === undefined || context === fallback) return [];
            return [(counts.get(context) ?? 0) > 1 ? `${name}: ${context}` : context];
        });
        return parts.length > 0 ? parts.join(" + ") : "default";
    };
}

function sourcesFor(
    resolver: Resolver,
    items: ExpandedItem[],
    sources: Map<SourceEntry, LoadedSource>,
    input: Input,
): LoadedPermutation["sources"] {
    return items.flatMap((item) => {
        if (item.kind === "set") {
            return item.entries.flatMap((entry) =>
                described(resolver, sources, entry, { set: item.set.name }),
            );
        }
        const context = input[item.modifier.name];
        if (context === undefined) return [];
        return (item.contexts.get(context) ?? []).flatMap((entry) =>
            described(resolver, sources, entry, {
                modifier: item.modifier.name,
                context,
                ...(entry.holder && { set: entry.holder.name }),
            }),
        );
    });
}

function described(
    resolver: Resolver,
    sources: Map<SourceEntry, LoadedSource>,
    entry: SourceEntry,
    from: Source["from"],
): LoadedPermutation["sources"] {
    const loaded = sources.get(entry);
    if (!loaded) return [];
    const pieces = loaded.pieces ?? [loaded];
    if (pieces[0] !== loaded) return [];
    const source = { file: loaded.file, ...(loaded.pointer && { pointer: loaded.pointer }), from };
    const holder = entry.holder?.extensions;
    const extensionsOfSet = holder && plainObject(holder, resolver.file.hidden);
    return [{ source, pieces, ...(extensionsOfSet && { extensionsOfSet }) }];
}

function whoUsesEachFile(
    items: ExpandedItem[],
    sources: Map<SourceEntry, LoadedSource>,
): Built["usedBy"] {
    const usedBy: Built["usedBy"] = {};
    const fileOf = (entry: SourceEntry) => sources.get(entry)?.file;

    for (const item of items) {
        if (item.kind !== "set") continue;
        for (const entry of item.entries) {
            const file = fileOf(entry);
            if (file !== undefined) usedBy[file] = "everyone";
        }
    }
    for (const item of items) {
        if (item.kind !== "modifier") continue;
        for (const [context, entries] of item.contexts) {
            for (const entry of entries) {
                const file = fileOf(entry);
                if (file === undefined) continue;
                const existing = usedBy[file];
                if (existing === "everyone") continue;
                const input = { [item.modifier.name]: context };
                const list = existing ?? [];
                if (!list.some((each) => each[item.modifier.name] === context)) list.push(input);
                usedBy[file] = list;
            }
        }
    }
    return usedBy;
}
