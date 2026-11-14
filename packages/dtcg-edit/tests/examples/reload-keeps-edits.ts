// Unsaved edits survive a page reload. They're kept in the browser's session storage after every
// change, and put back onto the files when the page comes back. If the files changed while it was
// away, each edit that still fits goes back, and the rest come back as clashes.
import { isEdits, type Session } from "@sugarcube-sh/dtcg-edit";

declare const session: Session;
declare const sessionStorage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
};

const key = "unsaved-edits";

session.subscribe(() => {
    sessionStorage.setItem(key, JSON.stringify(session.unsavedEdits));
});

export function restore(): void {
    const held: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!isEdits(held)) return;
    const clashes = session.restore(held);
    for (const { parts } of clashes) {
        for (const { path, file, yours, theirs } of parts) showClash(path ?? file, yours, theirs);
    }
}
