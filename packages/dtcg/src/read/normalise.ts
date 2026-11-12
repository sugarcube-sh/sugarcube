import type { Diagnostic, Input, ResolverContext, Source } from "../model.js";
import type { DiagnosticCollector } from "./diagnostics.js";
import { applyExtends } from "./extends.js";
import { type Merged, merge } from "./merge.js";
import type { MissingReferences } from "./missing.js";
import { sortByDocumentOrder } from "./order.js";
import type { ListedSource, LoadedPermutation } from "./permutations.js";
import type { LoadedSource } from "./sources.js";
import { type SourceContents, walkSource } from "./walk.js";
import { createSource } from "./linked.js";
import { sameSource } from "./same-object.js";

export interface NormalisedPermutation {
    input: Input;
    label: string;
    contexts: ResolverContext[];
    sources: Source[];
    merged: Merged;
    unreadSources: Source[];
}

export function normalisePermutations(
    permutations: LoadedPermutation[],
    diagnostics: DiagnosticCollector,
    missing: MissingReferences,
    generate: (merged: Merged, input: Input) => void,
    previous: readonly Source[] | undefined,
): { permutations: NormalisedPermutation[]; sources: Source[] } {
    const walked = new Map<string, { contents?: SourceContents; problems: Diagnostic[] }>();
    const walk = (loaded: LoadedSource, input?: Input) => {
        const key = JSON.stringify([loaded.file, loaded.pointer, loaded.overriddenKeys]);
        let found = walked.get(key);
        if (!found) {
            const problems: Diagnostic[] = [];
            const contents = walkSource(loaded, problems);
            found = { contents, problems: diagnostics.addAll(problems) };
            walked.set(key, found);
        }
        if (input) for (const each of found.problems) diagnostics.addInput(each, input);
        return found.contents;
    };
    const sourceCache = new Map<ListedSource, Source>();
    const readSources: Source[] = [];
    const toSource = (listed: ListedSource): Source => {
        const found = sourceCache.get(listed);
        if (found) return found;
        const { source, pieces } = listed;
        const extensions = pieces.map((each) => walk(each)?.root.extensions).find(Boolean);
        const candidate = { ...source, ...(extensions && { extensions }) };
        let shared = readSources.find((each) => sameSource(each, candidate));
        if (!shared) {
            const was = previous?.[readSources.length];
            shared =
                was && sameSource(was, candidate)
                    ? was
                    : createSource(candidate, readSources.length);
            readSources.push(shared);
        }
        sourceCache.set(listed, shared);
        return shared;
    };

    const normalised = permutations.map(({ input, label, contexts, sources }) => {
        const walkedPieces = sources.flatMap((each, source) =>
            each.pieces.map((piece) => ({ contents: walk(piece, input), source })),
        );
        const permutationSources = sources.map(toSource);
        const unread = new Set(
            walkedPieces.filter(({ contents }) => !contents).map(({ source }) => source),
        );
        const unreadSources = permutationSources.filter((_, index) => unread.has(index));
        const merged = merge(walkedPieces, input, diagnostics);
        const missingExtends = missing.createRecorder(input, merged.groups, unreadSources);
        applyExtends(merged, input, diagnostics, missingExtends);
        missingExtends.flush();
        generate(merged, input);
        sortByDocumentOrder(merged);
        return { input, label, contexts, sources: permutationSources, merged, unreadSources };
    });
    return { permutations: normalised, sources: readSources };
}
