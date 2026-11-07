import type { DesignTokens, Input, ReadOptions, ReadText, TokensInMemory } from "../model.js";
import type { Answer, FileText, Request } from "./files.js";
import { Problems, addPermutations } from "./diagnostics.js";
import { type Loaded, load } from "./load.js";
import { normalisePermutations } from "./normalise.js";
import { fillGenerated } from "./generate.js";
import { validateExtensions } from "./validate-extensions.js";
import type { Merged } from "./merge.js";
import { createValueReader } from "./parse-value.js";
import { buildPermutations } from "./build.js";
import { missingReferences } from "./missing.js";
import type { PermutationOptions } from "./permutations.js";
import { fileName, getFolder, join, normalise } from "./paths.js";
import { type KnownFiles, answerFrom, knownInMemory } from "./known-files.js";
import { parseJson } from "./json.js";
import { isResolver } from "./resolver.js";
import { thrownMessages } from "../error-messages.js";
import { linkedDesignTokens, trackPlaces } from "./linked.js";
import { allPermutations } from "./make-permutations.js";

const { performance } = globalThis as unknown as { performance: { now(): number } };

/**
 * Reads design tokens, starting from an entry file.
 *
 * It gets each file with `readText`, so it runs anywhere. For Node, use `read` from
 * `@sugarcube-sh/dtcg/node`.
 *
 * Problems in the files don't make it reject. They're listed in {@link DesignTokens.diagnostics}.
 * It rejects only when `readText` throws.
 *
 * @param entry - The resolver or token file, such as `"tokens.resolver.json"`. It's a resolver if
 * its name ends `.resolver.json`, or it has a top-level `resolutionOrder`.
 * @param options - The {@link ReadText | readText} that gets each file, and the other
 * {@link ReadOptions}.
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#file-extension | Resolver 3.2, File extension}
 *
 * @example
 * // Read over HTTP
 * const tokens = await read("tokens.resolver.json", {
 *     readText: async (path) => {
 *         const response = await fetch(path);
 *         if (response.status === 404) return undefined;
 *         if (!response.ok) throw new Error(`${response.status}`);
 *         return response.text();
 *     },
 * });
 */
export async function read(
    entry: string,
    { readText, ...options }: ReadOptions & { readText: ReadText },
): Promise<DesignTokens> {
    const started = performance.now();
    const run = load(fileName(entry), permutationOptions(options), undefined);
    const fetched = new Map<string, FileText>();
    let step = run.next();
    while (!step.done) {
        const answer = await fetchAll(step.value, getFolder(entry), readText);
        for (const [path, text] of Object.entries(answer)) fetched.set(normalise(path), text);
        step = run.next(answer);
    }
    options.onStage?.("load", performance.now() - started);
    const known = { entryFile: fileName(entry), texts: fetched, hasEveryFile: false };
    return toDesignTokens(step.value, options, undefined, known);
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
 * Reads design tokens from text you already have.
 *
 * Without an `entryFile`, it starts from the one resolver, or else the only file. Otherwise it
 * throws a `TypeError`.
 *
 * @param memory - Each file's text by name, such as `{ files: { "color.json": text } }`.
 * @param options - How to read them, from {@link ReadOptions}.
 *
 * @example
 * // One token file
 * const tokens = readFromMemory({ files: { "color.json": text } });
 */
export function readFromMemory(memory: TokensInMemory, options: ReadOptions = {}): DesignTokens {
    const texts = new Map(
        Object.entries(memory.files).map(([path, text]) => [normalise(path), text]),
    );
    const entry = memory.entryFile ?? entryAmong(texts);
    return readKnown(knownInMemory(entry, texts), options, undefined);
}

function readKnown(
    known: KnownFiles,
    options: ReadOptions,
    previous: DesignTokens | undefined,
): DesignTokens {
    const started = performance.now();
    const run = load(fileName(known.entryFile), permutationOptions(options), previous?.resolver);
    let step = run.next();
    while (!step.done) step = run.next(answerFrom(known, step.value));
    options.onStage?.("load", performance.now() - started);
    return toDesignTokens(step.value, options, previous, known);
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

function permutationOptions({
    inputs = "all",
    permutationLimit = 32,
}: ReadOptions): PermutationOptions {
    return { inputs, limit: permutationLimit };
}

function toDesignTokens(
    loaded: Loaded,
    options: ReadOptions,
    previous: DesignTokens | undefined,
    known: KnownFiles,
): DesignTokens {
    const {
        onStage,
        generators = [],
        extensionValidators = [],
        hexStringColors,
        ignoreUnknownProperties,
    } = options;
    const diagnostics = new Problems();
    const parseOptions = {
        hexStringColors: hexStringColors ?? false,
        ignoreUnknownProperties: ignoreUnknownProperties ?? false,
    };
    const readValue = createValueReader(diagnostics, parseOptions);
    let generating = 0;
    const generate = (merged: Merged, input: Input) => {
        if (generators.length === 0) return;
        const started = performance.now();
        fillGenerated(merged, generators, { input, parseOptions }, diagnostics);
        generating += performance.now() - started;
    };
    const normalising = performance.now();
    const missing = missingReferences(diagnostics);
    const { permutations: normalised, sources } = normalisePermutations(
        loaded.permutations,
        diagnostics,
        missing,
        generate,
        previous?.sources,
    );
    const resolving = performance.now();
    onStage?.("generate", generating);
    onStage?.("normalise", resolving - normalising - generating);
    const places = trackPlaces(loaded.texts, previous);
    const resolved = buildPermutations(normalised, {
        readValue,
        diagnostics,
        missing,
        places,
        previous,
    });
    missing.report();
    const permutations = allPermutations(resolved, loaded.resolver);
    onStage?.("resolve", performance.now() - resolving);
    validateExtensions(
        normalised,
        permutations,
        { validators: extensionValidators, parseOptions },
        diagnostics,
    );

    return linkedDesignTokens(
        {
            files: loaded.files,
            entryFile: loaded.entry,
            ...(loaded.resolver && { resolver: loaded.resolver }),
            sources,
            permutations,
            parseOptions,
            diagnostics: [
                ...addPermutations(loaded.diagnostics, permutations, loaded.entry),
                ...diagnostics.inPermutations(permutations),
            ],
        },
        {
            texts: loaded.texts,
            moved: places.moved,
            known,
            readAgain: (files, from) => readKnown(files, options, from),
        },
    );
}
