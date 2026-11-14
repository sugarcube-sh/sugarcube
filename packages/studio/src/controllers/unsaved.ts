import { decodeEdits, encodeEdits } from "./edits-text";
import type { Studio } from "./studio";

export type EditsStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export async function persistUnsavedEdits(
    studio: Studio,
    storage: EditsStorage,
    key: string,
): Promise<void> {
    let storedEdits = studio.unsaved;
    let latestWrite = 0;
    studio.subscribe(async () => {
        const { unsaved } = studio;
        if (unsaved === storedEdits) return;
        storedEdits = unsaved;
        const writeNumber = ++latestWrite;
        if (unsaved.steps.length === 0) {
            storage.removeItem(key);
            return;
        }
        const text = await encodeEdits(unsaved);
        if (writeNumber === latestWrite) storage.setItem(key, text);
    });

    const storedText = storage.getItem(key);
    const edits = storedText === null ? undefined : await decodeEdits(storedText);
    if (edits) studio.restore(edits);
    else if (storedText !== null) storage.removeItem(key);
}
