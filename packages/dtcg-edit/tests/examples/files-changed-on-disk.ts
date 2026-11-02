// The token files change on disk while the token editor has unsaved changes, because someone
// pulled new commits or edited a file in their code editor. The unsaved changes are put back on
// top of the new files. One to a token that also changed comes back as a clash, the token as you
// had it and as the files have it now, and the files' version is what shows.
import { type FileWatcher, createLiveTokens } from "@sugarcube-sh/dtcg/node";
import { type Session } from "@sugarcube-sh/dtcg-edit";

declare const session: Session;
declare const watcher: FileWatcher;

const live = createLiveTokens(
    { entry: "tokens.resolver.json" },
    { onError: (error) => showMessage(String(error)) },
);
live.watch(watcher);
live.onRead((tokens) => {
    for (const { parts } of session.rebase(tokens)) {
        for (const { path, file, yours, theirs } of parts) showClash(path ?? file, yours, theirs);
    }
});
