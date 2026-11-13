import type { Node } from "jsonc-parser";
import type {
    Diagnostic,
    IgnoredProperty,
    Input,
    ParseOptions,
    ParseResult,
    TokenType,
    UnresolvedValueByType,
    ValueError,
} from "../../model.js";
import { type DiagnosticExtra, type DiagnosticCollector } from "../diagnostics/diagnostics.js";
import { ignoredDiagnostic, valueDiagnostic } from "../diagnostics/value.js";
import {
    type ReadCollector,
    type Slot,
    type DeferredRead,
    type ReferenceInValue,
    readSlot,
    readToken,
} from "../../values/read-syntax.js";
import { deepestNode, markedNode, toSpan } from "../json/parse.js";
import type { MergedToken } from "../merge/merge.js";
import { type Occurrence, occurrence } from "./occurrence.js";

export interface LocatedReference {
    reference: ReferenceInValue;
    occurrence: Occurrence;
}

export interface ValueRead<V = unknown> {
    result: ParseResult<V>;
    references: LocatedReference[];
    deferredReads: DeferredRead[];
    diagnostics: Diagnostic[];
}

type Read = <T extends TokenType>(
    token: MergedToken,
    type: T,
    input: Input,
) => ValueRead<UnresolvedValueByType[T]>;

export interface ValueReader {
    read: Read;
    readSlot: (
        token: MergedToken,
        slot: Slot,
        raw: unknown,
        input: Input,
    ) => { result: ParseResult<unknown>; notes: ReadCollector };
}

type Cache = { [T in TokenType]?: Map<Node, ValueRead<UnresolvedValueByType[T]>> };

export function createValueReader(
    diagnostics: DiagnosticCollector,
    options: ParseOptions,
): ValueReader {
    const caches: Cache = {};

    const read: Read = (token, type, input) => {
        const notes: ReadCollector = { references: [], deferredReads: [] };
        const result = readToken(type, token.originalValue, ["$value"], options, notes);
        const toReport = [
            ...result.ignored.map((each) => ignoredToDiagnostic(token, each)),
            ...(result.ok ? [] : result.errors.map((error) => toDiagnostic(token, error))),
        ];
        const stored = diagnostics.addAll(toReport, input);
        const references = notes.references.map((reference) => ({
            reference,
            occurrence: occurrence(token, reference),
        }));
        return { result, references, deferredReads: notes.deferredReads, diagnostics: stored };
    };

    return {
        read: (token, type, input) => {
            if (token.generated) return read(token, type, input);
            const cache: NonNullable<Cache[typeof type]> = caches[type] ?? new Map();
            caches[type] = cache;
            const cached = cache.get(token.value);
            if (cached) {
                for (const each of cached.diagnostics) diagnostics.addInput(each, input);
                return cached;
            }
            const fresh = read(token, type, input);
            cache.set(token.value, fresh);
            return fresh;
        },
        readSlot: (token, slot, raw, input) => {
            const notes: ReadCollector = { references: [], deferredReads: [] };
            const result = readSlot(slot, raw, options, notes);
            if (!result.ok) {
                for (const error of result.errors) {
                    diagnostics.add(toDiagnostic(token, error), input);
                }
            }
            return { result, notes };
        },
    };
}

function ignoredToDiagnostic(token: MergedToken, ignored: IgnoredProperty): Diagnostic {
    const { json, value, path } = token;
    const within = { node: value, steps: ignored.jsonPath.slice(1), json };
    return ignoredDiagnostic(ignored, ignored.jsonPath, within, { path });
}

function toDiagnostic(token: MergedToken, error: ValueError): Diagnostic {
    const { json, value, path } = token;
    const node = deepestNode(value, error.jsonPath.slice(1));
    const span = toSpan(json, markedNode(node));
    const extra: DiagnosticExtra = { span, path };
    return valueDiagnostic(error.detail, error.jsonPath, node, extra);
}
