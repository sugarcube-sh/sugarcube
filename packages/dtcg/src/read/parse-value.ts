import type { Node } from "jsonc-parser";
import { fixTitles } from "../error-messages.js";
import type {
    Diagnostic,
    Parse,
    ParseResult,
    TokenType,
    UnresolvedValueByType,
    ValueError,
} from "../index.js";
import { diagnostic } from "./diagnostics.js";
import { hexAsObject } from "./hex-fix.js";
import { parsers } from "../values/parsers.js";
import { deepestNode, spanOf } from "./json.js";
import type { MergedToken } from "./merge.js";

export type ValueReader = <T extends TokenType>(
    token: MergedToken,
    type: T,
) => ParseResult<UnresolvedValueByType[T]>;

type Cache = { [T in TokenType]?: Map<Node, ParseResult<UnresolvedValueByType[T]>> };

export function createValueReader(diagnostics: Diagnostic[]): ValueReader {
    const caches: Cache = {};

    const read = <T extends TokenType>(token: MergedToken, type: T) => {
        const parse: Parse<UnresolvedValueByType[T]> = parsers[type];
        const result = parse(token.authored, ["$value"]);
        if (!result.ok) {
            for (const error of result.errors) diagnostics.push(toDiagnostic(token, error));
        }
        return result;
    };

    return <T extends TokenType>(token: MergedToken, type: T) => {
        if (token.added) return read(token, type);
        const cache: NonNullable<Cache[T]> = caches[type] ?? new Map();
        caches[type] = cache;
        const cached = cache.get(token.value);
        if (cached) return cached;
        const result = read(token, type);
        cache.set(token.value, result);
        return result;
    };
}

export function readReplaced<T extends TokenType>(
    token: MergedToken,
    type: T,
    raw: unknown,
    permutation: number,
    diagnostics: Diagnostic[],
): ParseResult<UnresolvedValueByType[T]> {
    const parse: Parse<UnresolvedValueByType[T]> = parsers[type];
    const result = parse(raw, ["$value"]);
    if (!result.ok) {
        for (const error of result.errors) {
            diagnostics.push({ ...toDiagnostic(token, error), permutation });
        }
    }
    return result;
}

function toDiagnostic(token: MergedToken, error: ValueError): Diagnostic {
    const { json, value, path } = token;
    const node = deepestNode(value, error.path.slice(1), json.hidden);
    const at = spanOf(json.path, json.lineStarts, node.offset, node.length);

    if (error.detail.reason === "hex-string" && typeof node.value === "string") {
        const { offset, length } = node;
        return diagnostic(
            "hex-string-color",
            { value: node.value },
            {
                at,
                path,
                fixes: [
                    {
                        title: fixTitles.hexToObject,
                        safe: true,
                        edits: [{ file: json.path, offset, length, text: hexAsObject(node.value) }],
                    },
                ],
            },
        );
    }
    return diagnostic("invalid-value", { at: error.path, ...error.detail }, { at, path });
}
