// An editor's undo history. Every unsaved edit can be undone, and the edits left are what gets
// saved. Undo stops at the save: once saved, there is nothing to undo. Starting the save ends the
// step being typed into, so what is sent can't change on the way.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { createSession, rename, setValue } from "@sugarcube-sh/dtcg-edit";

declare const opened: DesignTokens;
declare function sendSave(edits: string): Promise<boolean>;

const session = createSession(opened);
session.do(setValue(session.tokens, "color.brand", "#f43f5e"));
session.do(rename(session.tokens, "color.danger", "error"));
session.undo();

session.endStep();
const sent = session.unsaved;
if (await sendSave(JSON.stringify(sent))) session.markSaved(sent);
