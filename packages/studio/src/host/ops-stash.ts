import { decodeOps, encodeOps } from "../tokens/ops-codec";
import type { WriteOp } from "../tokens/write-ops";

const PREFIX = "sugarcube:studio:ops:";

function storage(): Storage | null {
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

/**
 * Unsaved operations, kept for as long as the tab lives. A dock reloads with
 * the page it sits on, and on any non-Vite dev server a markup edit reloads
 * the page, so without this every edit in the dock dies with the first save
 * in the editor. Keyed by the project, for the one case a tab can mix two up:
 * another project served on the same port, later, in the same tab.
 */
export async function readOpsStash(project: string): Promise<WriteOp[] | null> {
    const held = storage()?.getItem(PREFIX + project);
    if (!held) return null;
    try {
        return await decodeOps(held);
    } catch {
        storage()?.removeItem(PREFIX + project);
        return null;
    }
}

/** The number of the latest write per project; a write that is no longer the latest lands nothing. */
const latest = new Map<string, number>();

export async function writeOpsStash(project: string, ops: readonly WriteOp[]): Promise<void> {
    const store = storage();
    if (!store) return;

    const sequence = (latest.get(project) ?? 0) + 1;
    latest.set(project, sequence);

    if (ops.length === 0) {
        store.removeItem(PREFIX + project);
        return;
    }
    try {
        const encoded = await encodeOps(ops);
        if (latest.get(project) !== sequence) return;
        store.setItem(PREFIX + project, encoded);
    } catch {
        // Storage full or blocked: the edits are still in memory, only the reload safety is lost.
    }
}
