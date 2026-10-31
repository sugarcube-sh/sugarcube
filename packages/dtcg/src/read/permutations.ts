import type { Input, Resolver, ResolverContext, SetOnRoute, Source } from "../index.js";
import { ownLabel } from "../lookup/permutation-label.js";
import { diagnostic, type Problems } from "./diagnostics.js";
import { type Modifier, checkedInput, modifiersIn, withDefaults } from "./input.js";
import { type JsonFile, plainObject } from "./json.js";
import type { Loaded } from "./load.js";
import type { ExpandedItem, LoadedSource, SourceEntry, SourcePiece } from "./sources.js";

export interface ListedSource {
    source: Omit<Source, "extensions">;
    pieces: LoadedSource[];
}

export interface LoadedPermutation {
    input: Input;
    label: string;
    contexts: ResolverContext[];
    sources: ListedSource[];
}

type Built = Pick<Loaded, "permutations">;

export interface PermutationOptions {
    inputs?: readonly Readonly<Record<string, unknown>>[];
    permutations: "all" | "each-context";
    limit: number;
}

export function fromTokenFile(path: string, json: JsonFile | undefined): Built {
    return {
        permutations: [
            {
                input: {},
                label: "",
                contexts: [],
                sources: [
                    {
                        source: { file: path, sets: [], readBy: "everyone" },
                        pieces: [{ file: path, ...(json && { json, tree: json.root }) }],
                    },
                ],
            },
        ],
    };
}

export function fromResolver(
    part: Resolver,
    items: ExpandedItem[],
    sources: Map<SourcePiece, LoadedSource>,
    options: PermutationOptions,
    diagnostics: Problems,
): Built {
    const modifiers = modifiersIn(part);
    const inputs = chooseInputs(modifiers, options, diagnostics);
    const contextOf = (modifier: string, name: string | undefined) =>
        part.modifiers
            .find((each) => each.name === modifier)
            ?.contexts.find((each) => each.name === name);
    const listed = listedSources(items, sources, contextOf);
    return {
        permutations: inputs.map((input) => {
            const contexts = modifiers.flatMap(({ name }) => contextOf(name, input[name]) ?? []);
            return {
                input,
                label: ownLabel(contexts),
                contexts,
                sources: sourcesFor(items, listed, contextOf, input),
            };
        }),
    };
}

type ContextOf = (modifier: string, name: string | undefined) => ResolverContext | undefined;

function chooseInputs(
    modifiers: Modifier[],
    { inputs, permutations, limit }: PermutationOptions,
    diagnostics: Problems,
): Input[] {
    if (modifiers.length === 0) return [{}];
    if (inputs) {
        const checked = inputs.flatMap((raw, index) => {
            const found = checkedInput(modifiers, raw);
            if (found.ok) return [found.input];
            for (const problem of found.problems) {
                diagnostics.found(diagnostic("input-invalid", { input: index, ...problem }));
            }
            return [];
        });
        return distinct(modifiers, checked);
    }
    return permutations === "each-context"
        ? eachContext(modifiers)
        : allWithinLimit(modifiers, limit, diagnostics);
}

function distinct(modifiers: Modifier[], inputs: Input[]): Input[] {
    const seen = new Set<string>();
    return inputs.filter((input) => {
        const key = JSON.stringify(modifiers.map(({ name }) => input[name]));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function allWithinLimit(modifiers: Modifier[], limit: number, diagnostics: Problems): Input[] {
    const count = modifiers.reduce((product, { contexts }) => product * contexts.length, 1);
    if (count <= limit) return combinations(modifiers);
    const built = eachContext(modifiers);
    diagnostics.found(diagnostic("permutation-limit", { count, limit, built: built.length }));
    return built;
}

function combinations(modifiers: Modifier[]): Input[] {
    return modifiers.reduce<Input[]>(
        (inputs, { name, contexts }) =>
            inputs.flatMap((input) => contexts.map((context) => ({ ...input, [name]: context }))),
        [{}],
    );
}

function eachContext(modifiers: Modifier[]): Input[] {
    const chosen = combinations(
        modifiers.filter(({ default: fallback }) => fallback === undefined),
    );
    const walked = modifiers.flatMap((modifier) =>
        chosen.flatMap((choice) =>
            modifier.contexts.map((context) =>
                withDefaults(modifiers, { ...choice, [modifier.name]: context }),
            ),
        ),
    );
    return distinct(modifiers, walked);
}

type Listed = (entry: SourceEntry, context?: ResolverContext) => ListedSource | undefined;

function listedSources(
    items: ExpandedItem[],
    sources: Map<SourcePiece, LoadedSource>,
    contextOf: ContextOf,
): Listed {
    const readBy = whoReadsEachSource(items, sources, contextOf);
    const listed = new Map<SourceEntry, Map<ResolverContext | undefined, ListedSource>>();
    return (entry, context) => {
        const [first] = entry.pieces;
        const loaded = openedAs(entry, sources);
        if (!first || !loaded) return undefined;
        const pieces = entry.pieces.flatMap((piece) => sources.get(piece) ?? []);
        const byContext = listed.get(entry) ?? new Map<ResolverContext | undefined, ListedSource>();
        listed.set(entry, byContext);
        const found = byContext.get(context);
        if (found) return found;
        const source = {
            file: loaded.file,
            ...(loaded.pointer && { pointer: loaded.pointer }),
            ...(context && { modifier: context.modifier }),
            sets: route(first),
            readBy: readBy.get(sourceKey(loaded)) ?? "everyone",
        };
        const made = { source, pieces };
        byContext.set(context, made);
        return made;
    };
}

function sourcesFor(
    items: ExpandedItem[],
    listed: Listed,
    contextOf: ContextOf,
    input: Input,
): ListedSource[] {
    return items.flatMap((item) => {
        if (item.kind === "set") return item.entries.flatMap((entry) => listed(entry) ?? []);
        const name = input[item.modifier.name];
        if (name === undefined) return [];
        const context = contextOf(item.modifier.name, name);
        const entries = item.contexts.get(name) ?? [];
        return entries.flatMap((entry) => listed(entry, context) ?? []);
    });
}

function route({ route: steps }: SourcePiece): SetOnRoute[] {
    return steps.map(({ name, extensions }) => ({
        name,
        ...(extensions && { extensions: plainObject(extensions) }),
    }));
}

function whoReadsEachSource(
    items: ExpandedItem[],
    sources: Map<SourcePiece, LoadedSource>,
    contextOf: ContextOf,
): Map<string, Source["readBy"]> {
    const readBy = new Map<string, "everyone" | ResolverContext[]>();
    const read = (entry: SourceEntry, context?: ResolverContext) => {
        const loaded = openedAs(entry, sources);
        if (!loaded) return;
        const key = sourceKey(loaded);
        const existing = readBy.get(key);
        if (!context || existing === "everyone") {
            readBy.set(key, "everyone");
            return;
        }
        const list = existing ?? [];
        if (!list.includes(context)) list.push(context);
        readBy.set(key, list);
    };
    for (const item of items) {
        if (item.kind === "set") {
            for (const entry of item.entries) read(entry);
            continue;
        }
        for (const [name, entries] of item.contexts) {
            const context = contextOf(item.modifier.name, name);
            for (const entry of entries) read(entry, context);
        }
    }
    return readBy;
}

function openedAs(
    { pieces: [first] }: SourceEntry,
    sources: Map<SourcePiece, LoadedSource>,
): LoadedSource | undefined {
    return first && sources.get(first);
}

function sourceKey({ file, pointer }: LoadedSource): string {
    return JSON.stringify([file, pointer]);
}
