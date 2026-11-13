import type { Input, ResolverContext, Source } from "../../model/index.js";
import type { DiagnosticCollector } from "../diagnostics/diagnostics.js";
import { applyExtends } from "./extends.js";
import { type Merged, merge } from "./merge.js";
import type { MissingReferences } from "../build/missing.js";
import { sortByDocumentOrder } from "./order.js";
import type { ListedSource, LoadedPermutation } from "../resolver/permutations.js";
import type { LoadedSource } from "../resolver/sources.js";
import { type SourceContents, type WalkResult, walkSource } from "./walk.js";
import { createSource } from "../linked.js";
import { sameSource } from "../same-object.js";

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
    const normaliser = new Normaliser(diagnostics, missing, generate, previous);
    const normalised = permutations.map((permutation) => normaliser.normalise(permutation));
    return { permutations: normalised, sources: normaliser.sources };
}

interface WalkedPiece {
    contents: SourceContents | undefined;
    source: number;
}

class Normaliser {
    readonly sources: Source[] = [];
    readonly #diagnostics: DiagnosticCollector;
    readonly #missing: MissingReferences;
    readonly #generate: (merged: Merged, input: Input) => void;
    readonly #previous: readonly Source[] | undefined;
    readonly #walks = new Map<string, WalkResult>();
    readonly #sourceByListed = new Map<ListedSource, Source>();

    constructor(
        diagnostics: DiagnosticCollector,
        missing: MissingReferences,
        generate: (merged: Merged, input: Input) => void,
        previous: readonly Source[] | undefined,
    ) {
        this.#diagnostics = diagnostics;
        this.#missing = missing;
        this.#generate = generate;
        this.#previous = previous;
    }

    normalise({ input, label, contexts, sources }: LoadedPermutation): NormalisedPermutation {
        const pieces = sources.flatMap((each, source) =>
            each.pieces.map((piece) => ({ contents: this.#walk(piece, input), source })),
        );
        const permutationSources = sources.map((each) => this.#toSource(each));
        const unreadSources = findUnreadSources(pieces, permutationSources);

        const merged = merge(pieces, input, this.#diagnostics);
        this.#applyExtends(merged, input, unreadSources);
        this.#generate(merged, input);
        sortByDocumentOrder(merged);
        return { input, label, contexts, sources: permutationSources, merged, unreadSources };
    }

    #walk(loaded: LoadedSource, input?: Input): SourceContents | undefined {
        const key = JSON.stringify([loaded.file, loaded.pointer, loaded.overriddenKeys]);
        let walked = this.#walks.get(key);
        if (!walked) {
            const { contents, problems } = walkSource(loaded);
            walked = { contents, problems: this.#diagnostics.addAll(problems) };
            this.#walks.set(key, walked);
        }

        if (input) {
            for (const each of walked.problems) this.#diagnostics.addInput(each, input);
        }
        return walked.contents;
    }

    #toSource(listed: ListedSource): Source {
        const cached = this.#sourceByListed.get(listed);
        if (cached) return cached;

        const { source, pieces } = listed;
        const extensions = pieces.map((each) => this.#walk(each)?.root.extensions).find(Boolean);
        const candidate = { ...source, ...(extensions && { extensions }) };
        const shared =
            this.sources.find((each) => sameSource(each, candidate)) ?? this.#addSource(candidate);
        this.#sourceByListed.set(listed, shared);
        return shared;
    }

    #addSource(candidate: Source): Source {
        const position = this.sources.length;
        const was = this.#previous?.[position];
        const source = was && sameSource(was, candidate) ? was : createSource(candidate, position);
        this.sources.push(source);
        return source;
    }

    #applyExtends(merged: Merged, input: Input, unreadSources: Source[]): void {
        const missing = this.#missing.createRecorder(input, merged.groups, unreadSources);
        applyExtends(merged, input, this.#diagnostics, missing);
        missing.flush();
    }
}

function findUnreadSources(pieces: WalkedPiece[], sources: Source[]): Source[] {
    const unread = new Set(pieces.filter(({ contents }) => !contents).map(({ source }) => source));
    return sources.filter((_, index) => unread.has(index));
}
