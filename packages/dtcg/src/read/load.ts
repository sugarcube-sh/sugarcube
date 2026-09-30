import type { Diagnostic, Input } from "../index.js";
import {
    type Answer,
    type Request,
    createFiles,
    fetchFiles,
    openFile,
    parseFile,
} from "./files.js";
import {
    type PermutationOptions,
    type LoadedPermutation,
    fromResolver,
    fromTokenFiles,
} from "./permutations.js";
import { checkResolver, isResolver } from "./resolver.js";
import { entriesOf, expandSources, filesNamedBy, openSources } from "./sources.js";

export interface Loaded {
    files: string[];
    modifiers: Record<string, { contexts: string[]; default?: string }>;
    usedBy: Record<string, "everyone" | Input[]>;
    permutations: LoadedPermutation[];
    diagnostics: Diagnostic[];
}

export function* load(
    start: { entry: string } | { files: string[] },
    options: PermutationOptions,
): Generator<Request, Loaded, Answer> {
    const used: string[] = [];
    const diagnostics: Diagnostic[] = [];
    const files = createFiles(used, diagnostics);
    const loaded = (built: Pick<Loaded, "modifiers" | "usedBy" | "permutations">): Loaded => ({
        files: used,
        diagnostics,
        ...built,
    });

    const paths = "entry" in start ? [start.entry] : start.files;
    yield* fetchFiles(files, paths);

    const resolverPath = paths.find((path) => {
        const root = parseFile(files, path)?.root;
        return root !== undefined && isResolver(root);
    });
    if (resolverPath === undefined) {
        return loaded(
            fromTokenFiles(paths.map((path) => ({ path, json: openFile(files, path, "tokens") }))),
        );
    }

    const file = openFile(files, resolverPath, "resolver");
    if (!file) return loaded({ modifiers: {}, usedBy: {}, permutations: [] });

    const resolver = checkResolver(file, diagnostics);
    const items = expandSources(resolver, diagnostics);
    const entries = entriesOf(items);
    yield* fetchFiles(files, filesNamedBy(resolver, entries));
    const sources = openSources(files, resolver, entries);
    return loaded(fromResolver(resolver, items, sources, options, diagnostics));
}
