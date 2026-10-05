import type { Node } from "jsonc-parser";
import type {
    Diagnostic,
    IgnoredProperty,
    Parse,
    ParseOptions,
    ParseResult,
    TokenType,
    UnresolvedValueByType,
    ValueError,
} from "../index.js";
import { ignoredDiagnostic, valueDiagnostic } from "./value-diagnostic.js";
import { parsers } from "../values/parsers.js";
import { deepestNode, spanOf } from "./json.js";
import type { MergedToken } from "./merge.js";

type Read = <T extends TokenType>(
    token: MergedToken,
    type: T,
) => ParseResult<UnresolvedValueByType[T]>;

export interface ValueReader {
    read: Read;
    readReplaced: <T extends TokenType>(
        token: MergedToken,
        type: T,
        raw: unknown,
        permutation: number,
    ) => ParseResult<UnresolvedValueByType[T]>;
}

type Cache = { [T in TokenType]?: Map<Node, ParseResult<UnresolvedValueByType[T]>> };

export function createValueReader(diagnostics: Diagnostic[], options: ParseOptions): ValueReader {
    const caches: Cache = {};

    const parse = <T extends TokenType>(
        token: MergedToken,
        type: T,
        raw: unknown,
        replaced?: { permutation: number },
    ) => {
        const parser: Parse<UnresolvedValueByType[T]> = parsers[type];
        const result = parser(raw, ["$value"], options);
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

    return {
        read: (token, type) => {
            if (token.added) return parse(token, type, token.authored);
            const cache: NonNullable<Cache[typeof type]> = caches[type] ?? new Map();
            caches[type] = cache;
            const cached = cache.get(token.value);
            if (cached) return cached;
            const result = parse(token, type, token.authored);
            cache.set(token.value, result);
            return result;
        },
        readReplaced: (token, type, raw, permutation) => parse(token, type, raw, { permutation }),
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
