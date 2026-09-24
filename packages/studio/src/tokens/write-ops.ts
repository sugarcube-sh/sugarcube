import { type JsonPath, removeAt, renameKeyAt, setAt } from "./text-edits";

/**
 * What an edit did, addressed by path. A save replays these against the file as
 * it is on disk, so an unrelated change somewhere else in that file survives.
 * Byte offsets could not: against a shifted file they corrupt rather than clobber.
 */
export type FileWriteOp =
    | { kind: "renameKey"; path: JsonPath; name: string }
    | { kind: "set"; path: JsonPath; value: unknown }
    | { kind: "remove"; path: JsonPath };

export type WriteOp = FileWriteOp & { file: string };

export type FileOps = { path: string; ops: FileWriteOp[] };

/** Grouped per file, keeping the order they were recorded in. */
export function opsByFile(ops: readonly WriteOp[]): FileOps[] {
    const grouped = new Map<string, FileWriteOp[]>();

    for (const op of ops) {
        const held = grouped.get(op.file);
        if (held) held.push(op);
        else grouped.set(op.file, [op]);
    }

    return Array.from(grouped, ([path, list]) => ({ path, ops: list }));
}

export class WriteOpFailed extends Error {
    constructor(
        readonly file: string,
        readonly op: FileWriteOp,
    ) {
        super(
            `Could not apply ${op.kind} at ${op.path.join(".")} in ${file}. ` +
                "The node is not there any more — it may have changed on disk.",
        );
        this.name = "WriteOpFailed";
    }
}

export function applyWriteOps(text: string, ops: readonly FileWriteOp[], file: string): string {
    let next = text;

    for (const op of ops) {
        if (op.kind === "renameKey") {
            const renamed = renameKeyAt(next, op.path, op.name);
            if (renamed === undefined) throw new WriteOpFailed(file, op);
            next = renamed;
            continue;
        }
        next = op.kind === "remove" ? removeAt(next, op.path) : setAt(next, op.path, op.value);
    }

    return next;
}
