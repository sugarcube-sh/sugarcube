import { type JsonPath, nodeAt, removeAt, renameKeyAt, setAt } from "./text-edits";

/**
 * What an edit did, addressed by path. A save replays these against the file as
 * it is on disk, so an unrelated change somewhere else in that file survives.
 */
export type FileWriteOp =
    | { kind: "renameKey"; path: JsonPath; name: string }
    | { kind: "set"; path: JsonPath; value: unknown }
    | { kind: "add"; path: JsonPath; value: unknown }
    | { kind: "remove"; path: JsonPath };

export type WriteOp = FileWriteOp & { file: string };

export type FileOps = { path: string; ops: FileWriteOp[] };

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
                "The file changed since Studio read it, so this edit no longer fits.",
        );
        this.name = "WriteOpFailed";
    }
}

function applyOne(text: string, op: FileWriteOp, file: string): string {
    switch (op.kind) {
        case "renameKey": {
            const renamed = renameKeyAt(text, op.path, op.name);
            if (renamed === undefined) throw new WriteOpFailed(file, op);
            return renamed;
        }
        case "set": {
            const parent = op.path.slice(0, -1);
            const hasParent = parent.length === 0 || nodeAt(text, parent) !== undefined;
            if (!("value" in op) || op.value === undefined || !hasParent) {
                throw new WriteOpFailed(file, op);
            }
            return setAt(text, op.path, op.value);
        }
        case "add": {
            if (!("value" in op) || op.value === undefined || nodeAt(text, op.path) !== undefined) {
                throw new WriteOpFailed(file, op);
            }
            return setAt(text, op.path, op.value);
        }
        case "remove":
            return nodeAt(text, op.path) === undefined ? text : removeAt(text, op.path);
    }
}

export function applyWriteOps(text: string, ops: readonly FileWriteOp[], file: string): string {
    let next = text;
    for (const op of ops) next = applyOne(next, op, file);
    return next;
}
