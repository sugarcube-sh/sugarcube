import packageJson from "../../package.json" with { type: "json" };
import type { Document, ReadOptions, ReadText } from "../index.js";
import { type Answer, type Loaded, type Request, load } from "./load.js";
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
    const run = load({ entry: fileName(entry) });
    let step = run.next();
    while (!step.done) {
        step = run.next(await fetchAll(step.value, folderOf(entry), options.readText));
    }
    options.onStage?.("load", performance.now() - started);
    return toDocument(step.value);
}

async function fetchAll(paths: Request, folder: string, readText: ReadText): Promise<Answer> {
    const texts = await Promise.all(
        paths.map((path) =>
            Promise.resolve()
                .then(() => readText(join(folder, path)))
                .then(
                    (text) => (typeof text === "string" ? { text } : { missing: true as const }),
                    () => ({ missing: true as const }),
                ),
        ),
    );
    return Object.fromEntries(paths.map((path, i) => [path, texts[i] ?? { missing: true }]));
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
        /** @default the only file, when there is one */
        entry?: string;
    },
    options: ReadOptions = {},
): Document {
    const started = performance.now();
    const texts = new Map(
        Object.entries(sources.files).map(([path, text]) => [normalise(path), text]),
    );
    const entry = sources.entry ?? (texts.size === 1 ? [...texts.keys()][0] : undefined);
    const folder = entry === undefined ? "" : folderOf(normalise(entry));
    const run = load(
        entry === undefined ? { files: [...texts.keys()] } : { entry: fileName(entry) },
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
    return toDocument(step.value);
}

function toDocument(loaded: Loaded): Document {
    return {
        version: packageJson.version,
        files: loaded.files,
        modifiers: loaded.modifiers,
        readers: loaded.readers,
        permutations: loaded.permutations.map((permutation) => ({
            ...permutation,
            tokens: {},
            groups: {},
        })),
        graph: [],
        diagnostics: loaded.diagnostics,
    };
}
