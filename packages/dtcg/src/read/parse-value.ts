import type { Node } from "jsonc-parser";
import type {
    Diagnostic,
    IgnoredProperty,
    ParseOptions,
    ParseResult,
    TokenType,
    UnresolvedValueByType,
    ValueError,
} from "../index.js";
import { ignoredDiagnostic, valueDiagnostic } from "./value-diagnostic.js";
import { type Found, readToken } from "../values/read-shape.js";
import { deepestNode, spanOf } from "./json.js";
import type { MergedToken } from "./merge.js";
import { type Occurrence, occurrence } from "./value-references.js";

export interface ValueRead<V = unknown> {
    result: ParseResult<V>;
    references: Occurrence[];
}

type Read = <T extends TokenType>(
    token: MergedToken,
    type: T,
) => ValueRead<UnresolvedValueByType[T]>;

export interface ValueReader {
    read: Read;
    readReplaced: <T extends TokenType>(
        token: MergedToken,
        type: T,
        raw: unknown,
        permutation: number,
    ) => ParseResult<UnresolvedValueByType[T]>;
}

type Cache = { [T in TokenType]?: Map<Node, ValueRead<UnresolvedValueByType[T]>> };

export function createValueReader(diagnostics: Diagnostic[], options: ParseOptions): ValueReader {
    const caches: Cache = {};

    const parse = <T extends TokenType>(
        token: MergedToken,
        type: T,
        raw: unknown,
        { found, replaced }: { found?: Found[]; replaced?: { permutation: number } },
    ) => {
        const result = readToken(type, raw, ["$value"], options, found);
        if (!replaced) {
            for (const each of result.ignored) diagnostics.push(ignoredToDiagnostic(token, each));
        }
        if (!result.ok) {
            for (const error of result.errors) {
                diagnostics.push(toDiagnostic(token, error, replaced?.permutation));
            }
        }
        return result;
    };

    const read: Read = (token, type) => {
        const found: Found[] = [];
        const result = parse(token, type, token.authored, { found });
        return { result, references: found.map((each) => occurrence(token, each)) };
    };

    return {
        read: (token, type) => {
            if (token.added) return read(token, type);
            const cache: NonNullable<Cache[typeof type]> = caches[type] ?? new Map();
            caches[type] = cache;
            const cached = cache.get(token.value);
            if (cached) return cached;
            const fresh = read(token, type);
            cache.set(token.value, fresh);
            return fresh;
        },
        readReplaced: (token, type, raw, permutation) =>
            parse(token, type, raw, { replaced: { permutation } }),
    };
}

function ignoredToDiagnostic(token: MergedToken, ignored: IgnoredProperty): Diagnostic {
    const { json, value, path } = token;
    const within = { node: value, steps: ignored.path.slice(1), json };
    return ignoredDiagnostic(ignored, ignored.path, within, { path });
}

function toDiagnostic(token: MergedToken, error: ValueError, permutation?: number): Diagnostic {
    const { json, value, path } = token;
    const node = deepestNode(value, error.path.slice(1), json.hidden);
    const at = spanOf(json.path, json.lineStarts, node.offset, node.length);
    const extra = { at, path, ...(permutation !== undefined && { permutation }) };
    return valueDiagnostic(error.detail, error.path, node, json.path, extra);
}
