import type { RepoPermissions } from "forges";
import { describe, expect, it } from "vitest";
import { accessFrom, githubHost } from "../../src/git-hosts/github";

const INSTALL = "https://github.com/apps/acme-studio/installations/new";

const none: RepoPermissions = {
    admin: false,
    maintain: false,
    push: false,
    triage: false,
    pull: false,
};
const writer: RepoPermissions = { ...none, push: true, triage: true, pull: true };
const reader: RepoPermissions = { ...none, pull: true };

function repository(name: string, permissions: RepoPermissions) {
    return {
        id: 1,
        name,
        full_name: `acme/${name}`,
        owner: { login: "acme", id: 2, type: "Organization" },
        private: true,
        visibility: "private",
        default_branch: "main",
        html_url: `https://github.com/acme/${name}`,
        fork: false,
        archived: false,
        permissions,
    };
}

function github(answers: {
    installations: Array<{ id: number; owner: string; selection: "all" | "selected" }>;
    repositories?: Array<ReturnType<typeof repository>>;
    site?: RepoPermissions;
}) {
    const asked: Array<{ path: string; authorization: string | null }> = [];
    const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
        });
    const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        asked.push({ path: url.pathname, authorization: request.headers.get("authorization") });
        if (url.pathname === "/user/installations") {
            return json({
                total_count: answers.installations.length,
                installations: answers.installations.map(({ id, owner, selection }) => ({
                    id,
                    account: { login: owner, id: 2, type: "Organization" },
                    repository_selection: selection,
                    app_slug: "acme-studio",
                })),
            });
        }
        if (url.pathname.startsWith("/user/installations/")) {
            const repositories = answers.repositories ?? [];
            const size = Number(url.searchParams.get("per_page") ?? 30);
            const start = (Number(url.searchParams.get("page") ?? 1) - 1) * size;
            return json({
                total_count: repositories.length,
                repositories: repositories.slice(start, start + size),
            });
        }
        if (url.pathname === "/repos/acme/site" && answers.site)
            return json(repository("site", answers.site));
        return json({ message: "Not Found" }, 404);
    };
    const host = githubHost({
        key: "ghu_key",
        repository: "acme/site",
        branch: "main",
        login: "mark",
        install: INSTALL,
        fetch,
    });
    return { host, asked };
}

describe("what the person signed in may do on the repository", () => {
    it("is write for someone who can write, with the app on every repository", async () => {
        const { host } = github({
            installations: [{ id: 9, owner: "acme", selection: "all" }],
            site: writer,
        });
        expect(await host.access()).toStrictEqual({ can: "write" });
    });

    it("is read for someone who can only read", async () => {
        const { host } = github({
            installations: [{ id: 9, owner: "acme", selection: "all" }],
            site: reader,
        });
        expect(await host.access()).toStrictEqual({ can: "read" });
    });

    it("is nothing for someone GitHub doesn't show the repository to, with no pointer to install", async () => {
        const { host } = github({ installations: [{ id: 9, owner: "acme", selection: "all" }] });
        expect(await host.access()).toStrictEqual({ can: "nothing" });
    });

    it("is nothing, with the pointer to install, when the app isn't on the owner's account", async () => {
        const { host } = github({
            installations: [{ id: 9, owner: "someone-else", selection: "all" }],
            site: writer,
        });
        expect(await host.access()).toStrictEqual({ can: "nothing", install: INSTALL });
    });

    it("is nothing, with the pointer to install, when the app is on some of the owner's repositories but not this one", async () => {
        const { host } = github({
            installations: [{ id: 9, owner: "acme", selection: "selected" }],
            repositories: [repository("docs", writer)],
            site: writer,
        });
        expect(await host.access()).toStrictEqual({ can: "nothing", install: INSTALL });
    });

    it("takes the person's role from the installation's list when the app is on some repositories", async () => {
        const { host } = github({
            installations: [{ id: 9, owner: "acme", selection: "selected" }],
            repositories: [repository("docs", reader), repository("site", writer)],
        });
        expect(await host.access()).toStrictEqual({ can: "write" });
    });

    it("finds the repository on a later page of the installation's list", async () => {
        const others = Array.from({ length: 150 }, (_, n) => repository(`other-${n}`, writer));
        const { host } = github({
            installations: [{ id: 9, owner: "acme", selection: "selected" }],
            repositories: [...others, repository("site", reader)],
        });
        expect(await host.access()).toStrictEqual({ can: "read" });
    });

    it("finds the repository in the installation's list whatever its case", async () => {
        const { host } = github({
            installations: [{ id: 9, owner: "acme", selection: "selected" }],
            repositories: [repository("Site", writer)],
        });
        expect(await host.access()).toStrictEqual({ can: "write" });
    });

    it("matches the owner whatever its case", async () => {
        const { host } = github({
            installations: [{ id: 9, owner: "Acme", selection: "all" }],
            site: writer,
        });
        expect(await host.access()).toStrictEqual({ can: "write" });
    });

    it("asks GitHub with the person's key", async () => {
        const { host, asked } = github({
            installations: [{ id: 9, owner: "acme", selection: "all" }],
            site: writer,
        });
        await host.access();
        expect(asked.map(({ path }) => path)).toStrictEqual([
            "/user/installations",
            "/repos/acme/site",
        ]);
        expect(asked.every(({ authorization }) => authorization?.endsWith("ghu_key"))).toBe(true);
    });
});

describe("asking GitHub what someone may do", () => {
    it("says GitHub couldn't be reached when it can't be", async () => {
        const host = githubHost({
            key: "ghu_key",
            repository: "acme/site",
            branch: "main",
            login: "mark",
            fetch: async () => {
                throw new TypeError("Failed to fetch");
            },
        });
        await expect(host.access()).rejects.toThrow("Couldn't reach GitHub. Try again.");
    });
});

describe("the rule for what someone may do", () => {
    it("is write with push, read with pull, and does nothing otherwise", () => {
        expect(accessFrom({ installed: true, permissions: writer })).toStrictEqual({
            can: "write",
        });
        expect(accessFrom({ installed: true, permissions: reader })).toStrictEqual({ can: "read" });
        expect(accessFrom({ installed: true, permissions: none })).toStrictEqual({
            can: "nothing",
        });
        expect(accessFrom({ installed: true, permissions: undefined })).toStrictEqual({
            can: "nothing",
        });
    });

    it("points to installing the app only when it isn't installed, and only when there is somewhere to point", () => {
        expect(accessFrom({ installed: false, permissions: writer }, INSTALL)).toStrictEqual({
            can: "nothing",
            install: INSTALL,
        });
        expect(accessFrom({ installed: false, permissions: writer })).toStrictEqual({
            can: "nothing",
        });
    });
});
