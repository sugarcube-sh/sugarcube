import type { DesignTokens, Input, ReadOptions, ReadText, TokensInMemory } from "../index.js";
import type { Answer, FileText, Request } from "./files.js";
import { Problems, inReadingPermutations } from "./diagnostics.js";
import { type Loaded, load } from "./load.js";
import { normalisePermutations } from "./normalise.js";
import { fillGenerated } from "./generate.js";
import { validateExtensions } from "./validate-extensions.js";
import type { Merged } from "./merge.js";
import { createValueReader } from "./parse-value.js";
import { buildPermutations } from "./build.js";
import type { PermutationOptions } from "./permutations.js";
import { fileName, folderOf, join, normalise } from "./paths.js";
import { parseJson } from "./json.js";
import { isResolver } from "./resolver.js";
import { thrownMessages } from "../error-messages.js";
import { linkedDesignTokens, placesIn } from "./linked.js";
import { allPermutations } from "./permutations-of.js";

const { performance } = globalThis as unknown as { performance: { now(): number } };

/**
 * Reads design tokens: the entry file, and every file it refers to.
 *
 * Files are fetched through `readText`, so this runs anywhere: a browser, a worker, Deno, Bun or
 * Node. `@sugarcube-sh/dtcg/node` provides a version that reads from disk.
 *
 * Never rejects because of what is, or is not, in the files. A file that is not there
 * (`readText` gives `undefined`) or cannot be understood is reported in
 * {@link DesignTokens.diagnostics}, and the rest is still read. A file that could not be fetched
 * (`readText` throws or rejects) rejects the read, naming the file, with the error as its `cause`:
 * a network or permission failure is not a deleted file.
 *
 * @param entry A resolver document or a token file. It is read as a resolver when its name ends
 * `.resolver.json` (Resolver 3.2) or its top level has `resolutionOrder` (Resolver 4.1), and as a
 * token file otherwise.
 *
 * @example
 * const tokens = await read("tokens.resolver.json", {
 *   readText: async (path) => {
 *     const response = await fetch(path);
 *     if (response.status === 404) return undefined;
 *     if (!response.ok) throw new Error(`${response.status}`);
 *     return response.text();
 *   },
 * });
 */
export async function read(
    entry: string,
    { readText, ...options }: ReadOptions & { readText: ReadText },
): Promise<DesignTokens> {
    const started = performance.now();
    const run = load(fileName(entry), permutationOptions(options), undefined);
    let step = run.next();
    while (!step.done) {
        step = run.next(await fetchAll(step.value, folderOf(entry), readText));
    }
    options.onStage?.("load", performance.now() - started);
    return toDesignTokens(step.value, options, undefined);
}

async function fetchAll(files: Request, folder: string, readText: ReadText): Promise<Answer> {
    const fetched = await Promise.all(
        files.map(async (file): Promise<[string, FileText]> => {
            const path = join(folder, file);
            let text: string | undefined;
            try {
                text = await readText(path, file);
            } catch (cause) {
                throw new Error(thrownMessages.couldNotFetch(path), { cause });
            }
            return [file, text === undefined ? { missing: true } : { text }];
        }),
    );
    return Object.fromEntries(fetched);
}

/**
 * Reads design tokens from text already in memory.
 *
 * The read starts from one entry, a resolver or a token file: the one given, or else the one
 * resolver among the files, told apart as {@link read} tells its entry, or else the only file. Several token files with no resolver among
 * them are not read together, since only a resolver says which files to read and in what order
 * (Resolver 4.1, 6); several resolvers need an entry to say which. Either is refused
 * with a `TypeError` naming the files.
 *
 * @example
 * const tokens = readFromMemory({ files: { "tokens.json": text } });
 */
export function readFromMemory(memory: TokensInMemory, options: ReadOptions = {}): DesignTokens {
    return fromMemory(memory, options, undefined);
}

function fromMemory(
    memory: TokensInMemory,
    options: ReadOptions,
    previous: DesignTokens | undefined,
): DesignTokens {
    const started = performance.now();
    const texts = new Map(
        Object.entries(memory.files).map(([path, text]) => [normalise(path), text]),
    );
    const entry = normalise(memory.entry ?? entryAmong(texts));
    const folder = folderOf(entry);
    const run = load(fileName(entry), permutationOptions(options), previous?.resolver);

    let step = run.next();
    while (!step.done) {
        const answer: Answer = {};
        for (const path of step.value) {
            const text = texts.get(join(folder, path));
            answer[path] = text === undefined ? { missing: true } : { text };
        }
        step = run.next(answer);
    }
    options.onStage?.("load", performance.now() - started);
    return toDesignTokens(step.value, options, previous);
}

function entryAmong(texts: Map<string, string>): string {
    const names = [...texts.keys()];
    const [only] = names;
    if (names.length === 1 && only !== undefined) return only;
    const resolvers = names.filter((name) =>
        isResolver(name, parseJson(texts.get(name) ?? "").root),
    );
    const [resolver] = resolvers;
    if (resolvers.length === 1 && resolver !== undefined) return resolver;
    if (resolvers.length > 1) throw new TypeError(thrownMessages.severalResolvers(resolvers));
    throw new TypeError(thrownMessages.noResolver(names));
}

function readingAgain(entry: string, options: ReadOptions) {
    return (files: Record<string, string>, previous: DesignTokens) =>
        fromMemory({ files, entry }, options, previous);
}

function permutationOptions({
    inputs,
    permutations = "all",
    permutationLimit = 32,
}: ReadOptions): PermutationOptions {
    return { ...(inputs && { inputs }), permutations, limit: permutationLimit };
}

function toDesignTokens(
    loaded: Loaded,
    options: ReadOptions,
    previous: DesignTokens | undefined,
): DesignTokens {
    const {
        onStage,
        generators = [],
        extensionValidators = [],
        hexStringColors,
        ignoreUnknownProperties,
    } = options;
    const found = new Problems();
    const parseOptions = {
        hexStringColors: hexStringColors ?? false,
        ignoreUnknownProperties: ignoreUnknownProperties ?? false,
    };
    const readValue = createValueReader(found, parseOptions);
    let generating = 0;
    const generate = (merged: Merged, input: Input) => {
        if (generators.length === 0) return;
        const started = performance.now();
        fillGenerated(merged, generators, { input, parseOptions }, found);
        generating += performance.now() - started;
    };
    const normalising = performance.now();
    const { permutations: normalised, sources } = normalisePermutations(
        loaded.permutations,
        found,
        generate,
        previous?.sources,
    );
    const resolving = performance.now();
    onStage?.("generate", generating);
    onStage?.("normalise", resolving - normalising - generating);
    const places = placesIn(loaded.texts, previous);
    const resolved = buildPermutations(normalised, readValue, found, places, previous);
    const permutations = allPermutations(resolved, loaded.resolver);
    onStage?.("resolve", performance.now() - resolving);
    validateExtensions(
        normalised,
        permutations,
        { validators: extensionValidators, parseOptions },
        found,
    );

    return linkedDesignTokens(
        {
            files: loaded.files,
            entry: loaded.entry,
            ...(loaded.resolver && { resolver: loaded.resolver }),
            sources,
            permutations,
            parseOptions,
            diagnostics: [
                ...inReadingPermutations(loaded.diagnostics, permutations, loaded.entry),
                ...found.inPermutations(permutations),
            ],
        },
        {
            texts: loaded.texts,
            moved: places.moved,
            readFiles: readingAgain(loaded.entry, options),
        },
    );
}
