import { relatedMessages } from "../error-messages.js";
import type { Input, Span, WrittenReference } from "../index.js";
import { movedReference, namedPath, toReferenceTarget } from "../values/references.js";
import { diagnostic, type Problems } from "./diagnostics.js";
import { similarName } from "./similar.js";

interface Use {
    from: string;
    span: Span;
}

interface Missing {
    reference: WrittenReference;
    first: Use;
    uses: Use[];
}

interface MissingAcross {
    ref: string;
    similar: string | undefined;
    first: Use;
    uses: Use[];
    inputs: [Input, ...Input[]];
}

export interface MissingIn {
    record(reference: WrittenReference, from: string, span: Span): void;
    close(): void;
}

export interface MissingReferences {
    in(input: Input, paths: ReadonlyMap<string, unknown>): MissingIn;
    report(): void;
}

export function missingReferences(diagnostics: Problems): MissingReferences {
    const across = new Map<string, MissingAcross>();
    return {
        in: (input, paths) => {
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
                close: () => {
                    for (const [ref, { reference, first, uses }] of missing) {
                        const similar = similarReference(reference, paths, fromOf(uses));
                        const key = JSON.stringify([ref, similar]);
                        let entry = across.get(key);
                        if (entry) entry.inputs.push(input);
                        else {
                            entry = { ref, similar, first, uses: [], inputs: [input] };
                            across.set(key, entry);
                        }
                        for (const use of uses)
                            if (!entry.uses.some(({ span }) => span === use.span))
                                entry.uses.push(use);
                    }
                },
            };
        },
        report: () => {
            for (const { ref, similar, first, uses, inputs } of across.values()) {
                const relatedInformation = uses
                    .filter(({ span }) => span !== first.span)
                    .map((use) => ({
                        message: relatedMessages.alsoUsedHere,
                        span: use.span,
                        path: use.from,
                    }));
                const detail = {
                    ref,
                    from: fromOf(uses),
                    ...(similar !== undefined && { similar }),
                };
                const [input, ...others] = inputs;
                const made = diagnostic("missing-reference", detail, {
                    span: first.span,
                    path: first.from,
                    ...(relatedInformation.length > 0 && { relatedInformation }),
                });
                const found = diagnostics.found(made, input);
                for (const each of others) diagnostics.also(found, each);
            }
        },
    };
}

function fromOf(uses: readonly Use[]): string[] {
    return [...new Set(uses.map(({ from }) => from))];
}

function similarReference(
    reference: WrittenReference,
    paths: ReadonlyMap<string, unknown>,
    from: string[],
): string | undefined {
    const named = namedPath(reference);
    if (named === undefined || paths.has(named)) return undefined;
    const close = similarName(
        named,
        [...paths.keys()].filter((path) => !from.includes(path)),
    );
    if (close === undefined) return undefined;
    return toReferenceTarget(movedReference(reference, [{ from: named, to: close }]));
}
