import { relatedMessages } from "../../error-messages.js";
import type { Input } from "../../model/permutation.js";
import type { Source } from "../../model/source.js";
import type { Span } from "../../model/location.js";
import type { ParsedReference } from "../../model/reference.js";
import {
    applyMovesToReference,
    getReferencePath,
    toReferenceTarget,
} from "../../values/references.js";
import { diagnostic, type DiagnosticCollector } from "../diagnostics/diagnostics.js";
import { similarName } from "../diagnostics/similar.js";

interface Use {
    from: string;
    span: Span;
}

interface Missing {
    reference: ParsedReference;
    first: Use;
    uses: Use[];
}

interface MissingInInputs {
    ref: string;
    suggestion: string | undefined;
    first: Use;
    uses: Use[];
    inputs: [Input, ...Input[]];
}

export interface MissingRecorder {
    record(reference: ParsedReference, from: string, span: Span): void;
    flush(): void;
}

const NOOP_RECORDER: MissingRecorder = Object.freeze({ record: () => {}, flush: () => {} });

export interface MissingReferences {
    createRecorder(
        input: Input,
        paths: ReadonlyMap<string, unknown>,
        unreadSources: readonly Source[],
    ): MissingRecorder;
    report(): void;
}

export function missingReferences(diagnostics: DiagnosticCollector): MissingReferences {
    return new MissingAcrossPermutations(diagnostics);
}

class MissingAcrossPermutations implements MissingReferences {
    readonly #diagnostics: DiagnosticCollector;
    readonly #byReference = new Map<string, MissingInInputs>();

    constructor(diagnostics: DiagnosticCollector) {
        this.#diagnostics = diagnostics;
    }

    createRecorder(
        input: Input,
        paths: ReadonlyMap<string, unknown>,
        unreadSources: readonly Source[],
    ): MissingRecorder {
        if (unreadSources.length > 0) return NOOP_RECORDER;
        return new MissingInPermutation(this, input, paths);
    }

    add(input: Input, ref: string, suggestion: string | undefined, { first, uses }: Missing): void {
        const key = JSON.stringify([ref, suggestion]);
        let entry = this.#byReference.get(key);
        if (entry) entry.inputs.push(input);
        else {
            entry = { ref, suggestion, first, uses: [], inputs: [input] };
            this.#byReference.set(key, entry);
        }

        for (const use of uses) {
            if (!entry.uses.some(({ span }) => span === use.span)) entry.uses.push(use);
        }
    }

    report(): void {
        for (const entry of this.#byReference.values()) this.#reportMissing(entry);
    }

    #reportMissing({ ref, suggestion, first, uses, inputs }: MissingInInputs): void {
        const relatedInformation = uses
            .filter(({ span }) => span !== first.span)
            .map((use) => ({
                message: relatedMessages.alsoUsedHere,
                span: use.span,
                path: use.from,
            }));
        const detail = {
            ref,
            from: getUniquePaths(uses),
            ...(suggestion !== undefined && { suggestion }),
        };
        const report = diagnostic("missing-reference", detail, {
            span: first.span,
            path: first.from,
            ...(relatedInformation.length > 0 && { relatedInformation }),
        });

        const [input, ...others] = inputs;
        const stored = this.#diagnostics.add(report, input);
        for (const each of others) this.#diagnostics.addInput(stored, each);
    }
}

class MissingInPermutation implements MissingRecorder {
    readonly #all: MissingAcrossPermutations;
    readonly #input: Input;
    readonly #paths: ReadonlyMap<string, unknown>;
    readonly #missing = new Map<string, Missing>();

    constructor(all: MissingAcrossPermutations, input: Input, paths: ReadonlyMap<string, unknown>) {
        this.#all = all;
        this.#input = input;
        this.#paths = paths;
    }

    record(reference: ParsedReference, from: string, span: Span): void {
        const ref = toReferenceTarget(reference);
        const missing = this.#missing.get(ref) ?? { reference, first: { from, span }, uses: [] };
        missing.uses.push({ from, span });
        this.#missing.set(ref, missing);
    }

    flush(): void {
        for (const [ref, missing] of this.#missing) {
            const from = getUniquePaths(missing.uses);
            const suggestion = similarReference(missing.reference, this.#paths, from);
            this.#all.add(this.#input, ref, suggestion, missing);
        }
    }
}

function getUniquePaths(uses: readonly Use[]): string[] {
    return [...new Set(uses.map(({ from }) => from))];
}

function similarReference(
    reference: ParsedReference,
    paths: ReadonlyMap<string, unknown>,
    from: string[],
): string | undefined {
    const named = getReferencePath(reference);
    if (named === undefined || paths.has(named)) return undefined;
    const close = similarName(
        named,
        [...paths.keys()].filter((path) => path !== "" && !from.includes(path)),
    );
    if (close === undefined) return undefined;
    return toReferenceTarget(applyMovesToReference(reference, [{ from: named, to: close }]));
}
