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
 * Unsaved edits are held in sessionStorage so they survive a page reload: the
 * dock reloads along with the page it sits on, and outside Vite a markup edit
 * in the editor reloads that page. Keyed by project, because one tab can serve
 * two different projects on the same port over its life.
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
