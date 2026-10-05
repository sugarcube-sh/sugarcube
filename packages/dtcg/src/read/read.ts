import packageJson from "../../package.json" with { type: "json" };
import type { Document, ReadOptions, ReadText } from "../index.js";
import type { Answer, FileText, Request } from "./files.js";
import { collapse } from "./diagnostics.js";
import { type Loaded, load } from "./load.js";
import { normalisePermutations } from "./normalise.js";
import { fillGenerated } from "./generate.js";
import { validateExtensions } from "./validate-extensions.js";
import type { Merged } from "./merge.js";
import { createValueReader } from "./parse-value.js";
import { resolvePermutations } from "./resolve.js";
import type { PermutationOptions } from "./permutations.js";
import { fileName, folderOf, join, normalise } from "./paths.js";

const { performance } = globalThis as unknown as { performance: { now(): number } };

/**
 * Reads a design system: the entry file, and every file it refers to.
 *
 * Files are fetched through `readText`, so this runs anywhere: a browser, a worker, Deno, Bun or
 * Node. `@sugarcube-sh/dtcg/node` provides a version that reads from disk.
 *
 * Never rejects because of what is, or is not, in the files. A file that cannot be fetched
 * (`readText` throws) or cannot be read is reported in {@link Document.diagnostics}, and the rest
 * is still read.
 *
 * @param entry A resolver document or a token file.
 *
 * @example
 * const doc = await read("tokens.resolver.json", {
 *   readText: (path) => fetch(path).then((r) => r.text()),
 * });
 */
export async function read(
    entry: string,
    options: ReadOptions & { readText: ReadText },
): Promise<Document> {
    const started = performance.now();
    const run = load({ entry: fileName(entry) }, permutationOptions(options));
    let step = run.next();
    while (!step.done) {
        step = run.next(await fetchAll(step.value, folderOf(entry), options.readText));
    }
    options.onStage?.("load", performance.now() - started);
    return toDocument(step.value, options);
}

async function fetchAll(paths: Request, folder: string, readText: ReadText): Promise<Answer> {
    const fetched = await Promise.all(
        paths.map(async (path): Promise<[string, FileText]> => {
            try {
                const text = await readText(join(folder, path));
                return [path, typeof text === "string" ? { text } : { missing: true }];
            } catch {
                return [path, { missing: true }];
            }
        }),
    );
    return Object.fromEntries(fetched);
}

/**
 * Reads a design system from text already in memory.
 *
 * With a resolver among the files, it is the entry. Without one, every file is read as a single
 * set, in the order given, a later file overriding an earlier one: the rule a set in a resolver
 * follows.
 *
 * @example
 * const doc = readFromMemory({ files: { "tokens.json": text } });
 */
export function readFromMemory(
    sources: {
        files: Record<string, string>;
        /**
         * The file to start from.
         * @default the first resolver among the files, or else every file, in order
         */
        entry?: string;
    },
    options: ReadOptions = {},
): Document {
    const started = performance.now();
    const texts = new Map(
        Object.entries(sources.files).map(([path, text]) => [normalise(path), text]),
    );
    const { entry } = sources;
    const folder = entry === undefined ? "" : folderOf(normalise(entry));
    const run = load(
        entry === undefined ? { files: [...texts.keys()] } : { entry: fileName(entry) },
        permutationOptions(options),
    );

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
    return toDocument(step.value, options);
}

function permutationOptions({
    inputs,
    permutations = "all",
    permutationLimit = 32,
}: ReadOptions): PermutationOptions {
    return { ...(inputs && { inputs }), permutations, limit: permutationLimit };
}

function toDocument(
    loaded: Loaded,
    {
        onStage,
        generators = [],
        extensionValidators = [],
        hexStringColors,
        ignoreUnknownProperties,
    }: ReadOptions,
): Document {
    const found: Document["diagnostics"] = [];
    const readValue = createValueReader(found, { hexStringColors, ignoreUnknownProperties });
    let generating = 0;
    const generate = (merged: Merged, permutation: number) => {
        if (generators.length === 0) return;
        const started = performance.now();
        fillGenerated(merged, generators, permutation, found);
        generating += performance.now() - started;
    };
    const normalising = performance.now();
    const normalised = normalisePermutations(loaded.permutations, readValue, found, generate);
    const resolving = performance.now();
    onStage?.("generate", generating);
    onStage?.("normalise", resolving - normalising - generating);
    const permutations = resolvePermutations(normalised, readValue, found);
    onStage?.("resolve", performance.now() - resolving);
    validateExtensions(normalised, permutations, extensionValidators, found);

    return {
        version: packageJson.version,
        files: loaded.files,
        modifiers: loaded.modifiers,
        usedBy: loaded.usedBy,
        permutations,
        diagnostics: [...loaded.diagnostics, ...collapse(found, permutations.length)],
    };
}
