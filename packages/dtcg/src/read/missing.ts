import { relatedMessages } from "../error-messages.js";
import type { Input, Source, Span, ParsedReference } from "../model.js";
import {
    applyMovesToReference,
    getReferencePath,
    toReferenceTarget,
} from "../values/references.js";
import { diagnostic, type DiagnosticCollector } from "./diagnostics.js";
import { similarName } from "./similar.js";

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
    similar: string | undefined;
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
    const mergedAcrossInputs = new Map<string, MissingInInputs>();
    return {
        createRecorder: (input, paths, unreadSources) => {
            if (unreadSources.length > 0) return NOOP_RECORDER;
            const missing = new Map<string, Missing>();
            return {
                record: (reference, from, span) => {
                    const ref = toReferenceTarget(reference);
                    const entry = missing.get(ref) ?? {
                        reference,
                        first: { from, span },
                        uses: [],
                    };
                    entry.uses.push({ from, span });
                    missing.set(ref, entry);
                },
                flush: () => {
                    for (const [ref, { reference, first, uses }] of missing) {
                        const similar = similarReference(reference, paths, getUniquePaths(uses));
                        const key = JSON.stringify([ref, similar]);
                        let entry = mergedAcrossInputs.get(key);
                        if (entry) entry.inputs.push(input);
                        else {
                            entry = { ref, similar, first, uses: [], inputs: [input] };
                            mergedAcrossInputs.set(key, entry);
                        }
                        for (const use of uses)
                            if (!entry.uses.some(({ span }) => span === use.span))
                                entry.uses.push(use);
                    }
                },
            };
        },
        report: () => {
            for (const { ref, similar, first, uses, inputs } of mergedAcrossInputs.values()) {
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
                    ...(similar !== undefined && { similar }),
                };
                const [input, ...others] = inputs;
                const made = diagnostic("missing-reference", detail, {
                    span: first.span,
                    path: first.from,
                    ...(relatedInformation.length > 0 && { relatedInformation }),
                });
                const kept = diagnostics.add(made, input);
                for (const each of others) diagnostics.addInput(kept, each);
            }
        },
    };
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
