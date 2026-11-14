// Setting a color for mode: dark only. If more than one file could hold it, the person is asked
// which.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { commit, setValue } from "@sugarcube-sh/dtcg-edit";

declare let tokens: DesignTokens;

let edit = setValue(tokens, "color.danger", "#fca5a5", { input: { mode: "dark" } });
if (edit.question) edit = edit.question.answer(await askPerson(edit.question.files));

const done = commit(tokens, edit);
if (done.tokens) tokens = done.tokens;
else if (done.refusal) showMessage(done.refusal.reason);
else if (done.conflicts) showConflicts(done.conflicts);
