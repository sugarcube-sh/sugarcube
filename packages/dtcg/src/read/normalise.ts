import type { Diagnostic, Input, ResolverContext, Source } from "../index.js";
import type { Problems } from "./diagnostics.js";
import { applyExtends } from "./extends.js";
import { type Merged, merge } from "./merge.js";
import { inWrittenOrder } from "./order.js";
import type { ListedSource, LoadedPermutation } from "./permutations.js";
import type { LoadedSource } from "./sources.js";
import { type SourceContents, walkSource } from "./walk.js";
import { withPosition } from "./linked.js";
import { sameSource } from "./same-object.js";

export interface NormalisedPermutation {
    input: Input;
    label: string;
    contexts: ResolverContext[];
    sources: Source[];
    merged: Merged;
}

export function normalisePermutations(
    permutations: LoadedPermutation[],
    diagnostics: Problems,
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
            found = { contents, problems: diagnostics.foundAll(problems) };
            walked.set(key, found);
        }
        if (input) for (const each of found.problems) diagnostics.also(each, input);
        return found.contents;
    };
    const published = new Map<ListedSource, Source>();
    const readSources: Source[] = [];
    const publish = (listed: ListedSource): Source => {
        const found = published.get(listed);
        if (found) return found;
        const { source, pieces } = listed;
        const extensions = pieces.map((each) => walk(each)?.root.extensions).find(Boolean);
        const made = { ...source, ...(extensions && { extensions }) };
        let kept = readSources.find((each) => sameSource(each, made));
        if (!kept) {
            const was = previous?.[readSources.length];
            kept = was && sameSource(was, made) ? was : withPosition(made, readSources.length);
            readSources.push(kept);
        }
        published.set(listed, kept);
        return kept;
    };

    const normalised = permutations.map(({ input, label, contexts, sources }) => {
        const walkedPieces = sources.flatMap((each, source) =>
            each.pieces.map((piece) => ({ contents: walk(piece, input), source })),
        );
        const merged = merge(walkedPieces, input, diagnostics);
        applyExtends(merged, input, diagnostics);
        generate(merged, input);
        inWrittenOrder(merged);
        return { input, label, contexts, sources: sources.map(publish), merged };
    });
    return { permutations: normalised, sources: readSources };
}
