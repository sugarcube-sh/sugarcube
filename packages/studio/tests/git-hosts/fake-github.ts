import { repoRef } from "forges";
import { fake } from "forges/fake";
import { forgeHost } from "../../src/git-hosts/forge-host";

export const BUILT = "1".repeat(40);
export const REPOSITORY = "acme/site";

export function fakeGitHub(files: Readonly<Record<string, string>>) {
    const forge = fake({
        viewer: "mark",
        seed: {
            repos: [{ repo: REPOSITORY }],
            commits: [{ repo: REPOSITORY, sha: BUILT, message: "Start" }],
            files: Object.entries(files).flatMap(([path, content]) => [
                { repo: REPOSITORY, path, content, ref: BUILT },
                { repo: REPOSITORY, path, content },
            ]),
        },
    });
    const repo = repoRef(forge, REPOSITORY);
    const host = forgeHost(forge, {
        name: "GitHub",
        repository: REPOSITORY,
        branch: "main",
        login: "mark",
    });
    const changeOnGitHub = (path: string, content: string) =>
        forge.contents.commitFiles(repo, {
            branch: "main",
            message: "Changed on GitHub",
            changes: [{ path, content }],
        });
    const pulls = () => [...(forge.store.repos.get(REPOSITORY)?.threads.values() ?? [])];
    const lastCommit = () => forge.store.repos.get(REPOSITORY)?.commits.at(-1);
    const onBranch = async (path: string, head = pulls()[0]?.thread.branches?.head.ref) =>
        head === undefined
            ? undefined
            : forge.contents.getFile(repo, path, { ref: head, as: "text" }).then(
                  (file) => file.content,
                  () => undefined,
              );
    return { forge, repo, host, changeOnGitHub, pulls, lastCommit, onBranch };
}
