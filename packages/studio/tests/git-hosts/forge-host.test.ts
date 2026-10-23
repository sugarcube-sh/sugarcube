import { repoRef } from "forges";
import { fake } from "forges/fake";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgeHost, pullRequestBranch } from "../../src/git-hosts/forge-host";

const BUILT = "1".repeat(40);
const REPOSITORY = "acme/site";

function acme() {
    const forge = fake({
        viewer: "mark",
        seed: {
            repos: [{ repo: REPOSITORY }],
            commits: [{ repo: REPOSITORY, sha: BUILT, message: "Start" }],
            files: [
                { repo: REPOSITORY, path: "tokens/color.json", content: "as built", ref: BUILT },
                { repo: REPOSITORY, path: "tokens/old.json", content: "{}", ref: BUILT },
            ],
        },
    });
    const host = forgeHost(forge, { repository: REPOSITORY, branch: "main", login: "mark" });
    const repo = repoRef(forge, REPOSITORY);
    const changeElsewhere = (content: string) =>
        forge.contents.commitFiles(repo, {
            branch: "main",
            message: "Changed on GitHub",
            changes: [{ path: "tokens/color.json", content }],
        });
    return { forge, host, repo, changeElsewhere };
}

const changes = {
    written: { "tokens/color.json": "mine" },
    deleted: ["tokens/old.json"],
    title: "color.brand changed",
    description: "- color.brand changed",
};

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T14:05:09Z"));
});

afterEach(() => vi.useRealTimers());

describe("the branch's latest commit", () => {
    it("is the commit the branch points at now", async () => {
        const { host, changeElsewhere } = acme();
        expect(await host.latest()).toBe(BUILT);
        const moved = await changeElsewhere("new");
        expect(await host.latest()).toBe(moved.sha);
    });
});

describe("a file at a commit", () => {
    it("is the file as it was at that commit, not as the branch has it now", async () => {
        const { host, changeElsewhere } = acme();
        await changeElsewhere("changed since");
        expect(await host.file(BUILT, "tokens/color.json")).toBe("as built");
    });

    it("is undefined when the file isn't there", async () => {
        const { host } = acme();
        expect(await host.file(BUILT, "tokens/missing.json")).toBeUndefined();
    });

    it("rejects when the host can't be reached", async () => {
        const { forge, host } = acme();
        forge.offline();
        await expect(host.file(BUILT, "tokens/color.json")).rejects.toThrow();
    });
});

describe("a pull request", () => {
    it("commits the written and deleted files on a new branch from the commit it builds on", async () => {
        const { forge, host, repo } = acme();
        await host.openPullRequest({ from: BUILT, ...changes });
        const branch = "studio/mark/20261023-140509";
        const read = (path: string) =>
            forge.contents.getFile(repo, path, { ref: branch, as: "text" }).then(
                (file) => file.content,
                () => undefined,
            );
        expect(await read("tokens/color.json")).toBe("mine");
        expect(await read("tokens/old.json")).toBeUndefined();
        const [commit] = forge.store.repos.get(REPOSITORY)?.commits.slice(-1) ?? [];
        expect(commit?.parents).toStrictEqual([BUILT]);
        expect(commit?.message).toBe("color.brand changed");
    });

    it("builds on the commit it was given, though the branch has moved since", async () => {
        const { forge, host, changeElsewhere } = acme();
        await changeElsewhere("changed since");
        await host.openPullRequest({ from: BUILT, ...changes });
        const [commit] = forge.store.repos.get(REPOSITORY)?.commits.slice(-1) ?? [];
        expect(commit?.parents).toStrictEqual([BUILT]);
    });

    it("is committed as the person signed in, with no author of its own", async () => {
        const { forge, host } = acme();
        await host.openPullRequest({ from: BUILT, ...changes });
        const [commit] = forge.store.repos.get(REPOSITORY)?.commits.slice(-1) ?? [];
        expect(commit?.author?.actor?.login).toBe("mark");
    });

    it("opens a pull request from the new branch into the branch, titled and described", async () => {
        const { forge, host } = acme();
        const opened = await host.openPullRequest({ from: BUILT, ...changes });
        const [pull] = forge.store.repos.get(REPOSITORY)?.threads.values() ?? [];
        expect(pull?.thread).toMatchObject({
            kind: "pull_request",
            title: "color.brand changed",
            body: "- color.brand changed",
            branches: {
                head: { ref: "studio/mark/20261023-140509" },
                base: { ref: "main" },
            },
        });
        expect(opened).toStrictEqual({ number: 1, url: "https://fake.test/acme/site/pull/1" });
    });

    it("leaves the branch where it was", async () => {
        const { host } = acme();
        await host.openPullRequest({ from: BUILT, ...changes });
        expect(await host.latest()).toBe(BUILT);
    });
});

describe("a pull request's branch name", () => {
    it("is studio, the person and the time in UTC", () => {
        expect(pullRequestBranch("mark", new Date("2026-01-02T03:04:05Z"))).toBe(
            "studio/mark/20260102-030405",
        );
    });
});
