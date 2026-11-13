import type { Diagnostic } from "../model/diagnostic.js";
import type { Resolver } from "../model/resolver.js";
import {
    type FileResponse,
    type FileText,
    type FileRequest,
    createFiles,
    fetchFiles,
    openFile,
    parseFile,
} from "./files/open.js";
import {
    type PermutationOptions,
    type LoadedPermutation,
    fromResolver,
    fromTokenFile,
} from "./resolver/permutations.js";
import { checkResolver, isResolver } from "./resolver/check.js";
import { toPublicResolver } from "./resolver/public.js";
import { DiagnosticCollector } from "./diagnostics/diagnostics.js";
import { expandSources, allFiles, openSources, allPieces } from "./resolver/sources.js";
import { sameResolver } from "./build/reuse.js";

export interface Loaded {
    files: string[];
    texts: Record<string, string>;
    entry: string;
    resolver?: Resolver;
    permutations: LoadedPermutation[];
    diagnostics: Diagnostic[];
}

export function* load(
    entry: string,
    options: PermutationOptions,
    previous: Resolver | undefined,
): Generator<FileRequest, Loaded, FileResponse> {
    const diagnostics = new DiagnosticCollector();
    const files = createFiles(diagnostics);
    yield* fetchFiles(files, [entry]);

    const root = parseFile(files, entry)?.root;
    const loaded = (built: Pick<Loaded, "resolver" | "permutations">): Loaded => ({
        files: files.used,
        texts: pickUsedTexts(files.texts, files.used),
        entry,
        diagnostics: [...diagnostics.list],
        ...built,
    });
    if (!isResolver(entry, root)) {
        return loaded(fromTokenFile(entry, openFile(files, entry, "tokens")));
    }

    const file = openFile(files, entry, "resolver");
    if (!file) return loaded({ permutations: [] });

    const resolver = checkResolver(file, diagnostics);
    const { items, setsUsed } = expandSources(resolver, diagnostics);
    const pieces = allPieces(items);
    yield* fetchFiles(files, allFiles(pieces));
    const sources = openSources(files, resolver, pieces);
    const publicResolver = toPublicResolver(resolver, setsUsed, diagnostics);
    const part = previous && sameResolver(previous, publicResolver) ? previous : publicResolver;
    return loaded({
        resolver: part,
        ...fromResolver(part, items, sources, options, diagnostics),
    });
}

function pickUsedTexts(texts: Map<string, FileText>, used: string[]): Record<string, string> {
    const picked: Record<string, string> = {};
    for (const path of used) {
        const text = texts.get(path);
        if (text && "text" in text) picked[path] = text.text;
    }
    return picked;
}
