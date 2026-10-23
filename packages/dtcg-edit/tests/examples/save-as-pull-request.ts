// A server that turns saved edits into a pull request. It checks that what the browser sent is
// edits, reads the files from GitHub as they are now, applies the edits, and opens the pull request.
import { read } from "@sugarcube-sh/dtcg";
import { changedFiles, isEdits } from "@sugarcube-sh/dtcg-edit";

declare const body: { edits: unknown; title: string };
declare function readFromGitHub(path: string): Promise<string | undefined>;

if (!isEdits(body.edits)) throw new Error("not edits");
const tokens = await read("tokens.resolver.json", { readText: readFromGitHub });
const changes = changedFiles(tokens, body.edits);
if (changes.conflicts) {
    showConflicts(changes.conflicts);
} else {
    await openPullRequest(changes, {
        title: body.title,
        body: "Saved from the token editor",
    });
}
