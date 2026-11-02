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
} from "../model.js";
import { type DiagnosticExtra, type Problems } from "./diagnostics.js";
import { ignoredDiagnostic, valueDiagnostic } from "./value-diagnostic.js";
import {
    type Notes,
    type Slot,
    type ReadAgain,
    type ReferenceRead,
    readSlot,
    readToken,
} from "../values/read-syntax.js";
import { deepestNode, spanOf } from "./json.js";
import type { MergedToken } from "./merge.js";
import { type Occurrence, occurrence } from "./occurrence.js";

export interface LocatedReference {
    reference: ReferenceRead;
    occurrence: Occurrence;
}

export interface ValueRead<V = unknown> {
    result: ParseResult<V>;
    references: LocatedReference[];
    readAgain: ReadAgain[];
    diagnostics: Diagnostic[];
}

type Read = <T extends TokenType>(
    token: MergedToken,
    type: T,
    input: Input,
) => ValueRead<UnresolvedValueByType[T]>;

export interface ValueReader {
    read: Read;
    readTarget: (
        token: MergedToken,
        slot: Slot,
        raw: unknown,
        input: Input,
    ) => { result: ParseResult<unknown>; notes: Notes };
}

type Cache = { [T in TokenType]?: Map<Node, ValueRead<UnresolvedValueByType[T]>> };

export function createValueReader(diagnostics: Problems, options: ParseOptions): ValueReader {
    const caches: Cache = {};

    const read: Read = (token, type, input) => {
        const notes: Notes = { references: [], readAgain: [] };
        const result = readToken(type, token.valueAsWritten, ["$value"], options, notes);
        const found = [
            ...result.ignored.map((each) => ignoredToDiagnostic(token, each)),
            ...(result.ok ? [] : result.errors.map((error) => toDiagnostic(token, error))),
        ];
        const kept = diagnostics.foundAll(found, input);
        const references = notes.references.map((reference) => ({
            reference,
            occurrence: occurrence(token, reference),
        }));
        return { result, references, readAgain: notes.readAgain, diagnostics: kept };
    };

    return {
        read: (token, type, input) => {
            if (token.added) return read(token, type, input);
            const cache: NonNullable<Cache[typeof type]> = caches[type] ?? new Map();
            caches[type] = cache;
            const cached = cache.get(token.value);
            if (cached) {
                for (const each of cached.diagnostics) diagnostics.also(each, input);
                return cached;
            }
            const fresh = read(token, type, input);
            cache.set(token.value, fresh);
            return fresh;
        },
        readTarget: (token, slot, raw, input) => {
            const notes: Notes = { references: [], readAgain: [] };
            const result = readSlot(slot, raw, options, notes);
            if (!result.ok) {
                for (const error of result.errors) {
                    diagnostics.found(toDiagnostic(token, error), input);
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
    const span = spanOf(json, node);
    const extra: DiagnosticExtra = { span, path };
    return valueDiagnostic(error.detail, error.jsonPath, node, extra);
}
