import type { ReadOptions } from "@sugarcube-sh/dtcg";
import type { Conflict, FileOp, Project } from "./index.js";

/**
 * Opens a design system from disk for editing. Paths in the result are relative to the entry's
 * folder: join them with it to reach a file on disk.
 */
export function open(entry: string, options?: ReadOptions): Promise<Project> {
    throw new Error("not implemented yet");
}

/**
 * Applies edits to the files on disk. Each file is read as it is now, so edits made elsewhere
 * in the meantime are kept, and edits that no longer apply, as `apply` decides, are
 * returned as conflicts.
 *
 * Only files the design system reads once the edits are applied can be written: a new file must
 * be added to the resolver by the same edits, and a file such as `package.json` is always
 * refused. A file can only be deleted if the design system read it before the edits and no
 * longer reads it after them.
 *
 * Every edit is applied in memory before any file is written, so if one fails, nothing is
 * written. Each file is written to a temporary copy and then renamed into place, so no file is
 * left half-written.
 */
export function applyToDisk(
    project: Project,
    ops: FileOp[],
): Promise<{ written: string[] } | { conflicts: Conflict[] } | { refused: { reason: string } }> {
    throw new Error("not implemented yet");
}
