import type { Diagnostic, Resolver } from "../model.js";
import {
    type Answer,
    type FileText,
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
    fromTokenFile,
} from "./permutations.js";
import { checkResolver, isResolver } from "./resolver.js";
import { resolverPart } from "./resolver-part.js";
import { Problems } from "./diagnostics.js";
import { expandSources, allFiles, openSources, allPieces } from "./sources.js";
import { sameResolver } from "./same-object.js";

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
): Generator<Request, Loaded, Answer> {
    const diagnostics = new Problems();
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
    const made = resolverPart(resolver, setsUsed, diagnostics);
    const part = previous && sameResolver(previous, made) ? previous : made;
    return loaded({
        resolver: part,
        ...fromResolver(part, items, sources, options, diagnostics),
    });
}

function pickUsedTexts(texts: Map<string, FileText>, used: string[]): Record<string, string> {
    const kept: Record<string, string> = {};
    for (const path of used) {
        const text = texts.get(path);
        if (text && "text" in text) kept[path] = text.text;
    }
    return kept;
}
