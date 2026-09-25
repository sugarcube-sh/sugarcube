import type { TokenSources } from "@sugarcube-sh/core/client";
import { unwrapRef, wrapRef } from "./paths";
import { type JsonPath, renameKeyAt, setAt } from "./text-edits";
import type { WriteOp } from "./write-ops";

export type PathMoves = ReadonlyArray<readonly [string, string]>;

export type RenameResult = {
    sources: TokenSources;
    moves: PathMoves;
    /** One entry per file touched, in the order they were edited. */
    touched: string[];
    /** In the order performed: a key move applies before the references into it. */
    ops: WriteOp[];
};

export function movedTo(path: string, moves: PathMoves): string | undefined {
    let current = path;
    for (const [from, to] of moves) {
        if (current === from) current = to;
        else if (current.startsWith(`${from}.`)) current = `${to}${current.slice(from.length)}`;
    }
    return current === path ? undefined : current;
}

function* stringLeaves(node: unknown, at: JsonPath = []): Generator<[JsonPath, string]> {
    if (typeof node === "string") {
        yield [at, node];
        return;
    }
    if (Array.isArray(node)) {
        for (const [index, item] of node.entries()) yield* stringLeaves(item, [...at, index]);
        return;
    }
    if (node !== null && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) yield* stringLeaves(value, [...at, key]);
    }
}

/**
 * Renames a node and rewrites every reference into it, as text edits against
 * the files themselves. The key moves in place, so children, ordering,
 * formatting and comments are never taken apart.
 */
export function renameInSources(
    sources: TokenSources,
    from: string,
    to: string,
): RenameResult | null {
    if (from === to) return { sources, moves: [], touched: [], ops: [] };

    const moves: PathMoves = [[from, to]];
    const files = { ...sources.files };
    const touched: string[] = [];
    const ops: WriteOp[] = [];
    const name = to.split(".").at(-1) as string;

    for (const [path, text] of Object.entries(sources.files)) {
        const renamed = renameKeyAt(text, from.split("."), name);
        if (renamed === undefined) continue;
        files[path] = renamed;
        touched.push(path);
        ops.push({ kind: "renameKey", file: path, path: from.split("."), name });
    }

    if (touched.length === 0) return null;

    for (const [path, text] of Object.entries(files)) {
        let next = text;
        let parsed: unknown;
        try {
            parsed = JSON.parse(next);
        } catch {
            continue;
        }

        for (const [at, value] of stringLeaves(parsed)) {
            const reference = unwrapRef(value);
            if (reference === undefined) continue;
            const target = movedTo(reference, moves);
            if (target === undefined) continue;
            next = setAt(next, at, wrapRef(target));
            ops.push({ kind: "set", file: path, path: at, value: wrapRef(target) });
        }

        if (next === text) continue;
        files[path] = next;
        if (!touched.includes(path)) touched.push(path);
    }

    return { sources: { ...sources, files }, moves, touched, ops };
}
