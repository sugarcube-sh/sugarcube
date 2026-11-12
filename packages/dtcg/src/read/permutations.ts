import type { Input, Resolver, ResolverContext, ParentSet, Source } from "../model.js";
import { relatedMessages } from "../error-messages.js";
import { formatContextsLabel } from "../lookup/permutation-label.js";
import { diagnostic, type DiagnosticCollector } from "./diagnostics.js";
import { type Modifier, checkInput, allModifiers, withDefaults } from "./input.js";
import { type JsonFile, toPlainObject } from "./json.js";
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

type LoadedPermutations = Pick<Loaded, "permutations">;

export interface PermutationOptions {
    inputs: readonly Readonly<Record<string, unknown>>[] | "all" | "each-context";
    limit: number;
}

export function fromTokenFile(path: string, json: JsonFile | undefined): LoadedPermutations {
    return {
        permutations: [
            {
                input: {},
                label: "",
                contexts: [],
                sources: [
                    {
                        source: { file: path, sets: [], contexts: "every-context" },
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
    diagnostics: DiagnosticCollector,
): LoadedPermutations {
    const modifiers = allModifiers(part);
    const inputs = selectInputs(modifiers, options, diagnostics);
    const findContext = (modifier: string, name: string | undefined) =>
        part.modifiers
            .find((each) => each.name === modifier)
            ?.contexts.find((each) => each.name === name);
    const listed = createSourceLookup(items, sources, findContext);
    return {
        permutations: inputs.map((input) => {
            const contexts = modifiers.flatMap(({ name }) => findContext(name, input[name]) ?? []);
            return {
                input,
                label: formatContextsLabel(contexts),
                contexts,
                sources: getSourcesForInput(items, listed, findContext, input),
            };
        }),
    };
}

type FindContext = (modifier: string, name: string | undefined) => ResolverContext | undefined;

function selectInputs(
    modifiers: Modifier[],
    { inputs, limit }: PermutationOptions,
    diagnostics: DiagnosticCollector,
): Input[] {
    if (modifiers.length === 0) return [{}];
    if (inputs === "each-context") return getSingleModifierVariations(modifiers);
    if (inputs === "all") return getCombinationsWithinLimit(modifiers, limit, diagnostics);
    const checked = inputs.flatMap((raw, index) => {
        const result = checkInput(modifiers, raw);
        if (result.ok) return [result.input];
        for (const problem of result.problems) {
            const span = modifiers.find(({ name }) => name === problem.modifier)?.span;
            const declared = span && [{ message: relatedMessages.modifierDeclaredHere, span }];
            diagnostics.add(
                diagnostic(
                    "input-invalid",
                    { input: index, ...problem },
                    { ...(declared && { relatedInformation: declared }) },
                ),
            );
        }
        return [];
    });
    return distinct(modifiers, checked);
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

function getCombinationsWithinLimit(
    modifiers: Modifier[],
    limit: number,
    diagnostics: DiagnosticCollector,
): Input[] {
    const count = modifiers.reduce((product, { contexts }) => product * contexts.length, 1);
    if (count <= limit) return combinations(modifiers);
    const built = getSingleModifierVariations(modifiers);
    diagnostics.add(diagnostic("permutation-limit", { count, limit, built: built.length }));
    return built;
}

function combinations(modifiers: Modifier[]): Input[] {
    return modifiers.reduce<Input[]>(
        (inputs, { name, contexts }) =>
            inputs.flatMap((input) => contexts.map((context) => ({ ...input, [name]: context }))),
        [{}],
    );
}

function getSingleModifierVariations(modifiers: Modifier[]): Input[] {
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

type SourceLookup = (entry: SourceEntry, context?: ResolverContext) => ListedSource | undefined;

function createSourceLookup(
    items: ExpandedItem[],
    sources: Map<SourcePiece, LoadedSource>,
    findContext: FindContext,
): SourceLookup {
    const contextsBySource = getContextsBySource(items, sources, findContext);
    const listed = new Map<SourceEntry, Map<ResolverContext | undefined, ListedSource>>();
    return (entry, context) => {
        const [first] = entry.pieces;
        const loaded = getLoadedSource(entry, sources);
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
            contexts: contextsBySource.get(sourceKey(loaded)) ?? "every-context",
        };
        const made = { source, pieces };
        byContext.set(context, made);
        return made;
    };
}

function getSourcesForInput(
    items: ExpandedItem[],
    listed: SourceLookup,
    findContext: FindContext,
    input: Input,
): ListedSource[] {
    return items.flatMap((item) => {
        if (item.kind === "set") return item.entries.flatMap((entry) => listed(entry) ?? []);
        const name = input[item.modifier.name];
        if (name === undefined) return [];
        const context = findContext(item.modifier.name, name);
        const entries = item.contexts.get(name) ?? [];
        return entries.flatMap((entry) => listed(entry, context) ?? []);
    });
}

function route({ route: steps }: SourcePiece): ParentSet[] {
    return steps.map(({ name, extensions }) => ({
        name,
        ...(extensions && { extensions: toPlainObject(extensions) }),
    }));
}

function getContextsBySource(
    items: ExpandedItem[],
    sources: Map<SourcePiece, LoadedSource>,
    findContext: FindContext,
): Map<string, Source["contexts"]> {
    const bySource = new Map<string, "every-context" | ResolverContext[]>();
    const read = (entry: SourceEntry, context?: ResolverContext) => {
        const loaded = getLoadedSource(entry, sources);
        if (!loaded) return;
        const key = sourceKey(loaded);
        const existing = bySource.get(key);
        if (!context || existing === "every-context") {
            bySource.set(key, "every-context");
            return;
        }
        const list = existing ?? [];
        if (!list.includes(context)) list.push(context);
        bySource.set(key, list);
    };
    for (const item of items) {
        if (item.kind === "set") {
            for (const entry of item.entries) read(entry);
            continue;
        }
        for (const [name, entries] of item.contexts) {
            const context = findContext(item.modifier.name, name);
            for (const entry of entries) read(entry, context);
        }
    }
    return bySource;
}

function getLoadedSource(
    { pieces: [first] }: SourceEntry,
    sources: Map<SourcePiece, LoadedSource>,
): LoadedSource | undefined {
    return first && sources.get(first);
}

function sourceKey({ file, pointer }: LoadedSource): string {
    return JSON.stringify([file, pointer]);
}
