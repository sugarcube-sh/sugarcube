// An editor's undo history. Every edit is kept so it can be undone, and the kept edits are what
// gets saved.
import {
    createSession,
    encodeEdits,
    rename,
    setValue,
    type Project,
} from "@sugarcube-sh/dtcg-edit";

declare const opened: Project;
declare function sendSave(encoded: string): Promise<boolean>;

const session = createSession(opened);
session.do(setValue(session.project, "color.brand", "#f43f5e"));
session.do(rename(session.project, "color.danger", "error"));
session.undo();

if (await sendSave(await encodeEdits(session.unsaved))) session.saved();
