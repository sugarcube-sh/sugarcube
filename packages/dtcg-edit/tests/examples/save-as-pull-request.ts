// A server that turns saved edits into a pull request. It reads the files from GitHub as they are
// now, applies the edits, and opens the pull request.
import { open, apply, changedFiles, decodeEdits } from "@sugarcube-sh/dtcg-edit";

declare const body: { edits: string; title: string };
declare function readFromGitHub(path: string): Promise<string>;

const project = await open("tokens.resolver.json", { readText: readFromGitHub });
const next = apply(project, (await decodeEdits(body.edits)).ops);
if ("conflicts" in next) {
    showConflicts(next.conflicts);
} else {
    await openPullRequest(changedFiles(project, next), {
        title: body.title,
        body: "Saved from Studio",
    });
}
