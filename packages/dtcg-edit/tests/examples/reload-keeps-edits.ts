// Unsaved edits survive a page reload. They're kept in the browser's session storage after every
// change, and replayed onto the files when the page comes back, even if the files changed while it
// was away.
import { decodeEdits, encodeEdits, type Session } from "@sugarcube-sh/dtcg-edit";

declare const session: Session;
declare const sessionStorage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
};

const key = "unsaved-edits";

session.subscribe(async () => {
    sessionStorage.setItem(key, await encodeEdits(session.unsaved));
});

export async function restore(): Promise<void> {
    const held = sessionStorage.getItem(key);
    if (!held) return;
    const conflicts = session.restore(await decodeEdits(held));
    if (conflicts.length) showConflicts(conflicts);
}
