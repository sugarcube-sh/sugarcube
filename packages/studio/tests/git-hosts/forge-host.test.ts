import {
    ForbiddenError,
    ForgeNetworkError,
    InsufficientScopeError,
    NotFoundError,
    RateLimitedError,
    TokenRevokedError,
} from "forges";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pullRequestBranch } from "../../src/git-hosts/forge-host";
import { KeyRefused, Refused } from "../../src/git-hosts/git-host";
import { UserFacingError } from "../../src/error-messages";
import { STUDIO_BRANCH_PREFIX } from "../../src/studio-names";
import { BUILT, fakeGitHub } from "./fake-github";

const OPENED_AT = new RegExp(`^${STUDIO_BRANCH_PREFIX}/mark/20261023-140509-[0-9a-f]{4}$`);

const acme = () => fakeGitHub({ "tokens/color.json": "as built", "tokens/old.json": "{}" });

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
        const { host, changeOnGitHub } = acme();
        expect(await host.latest()).toBe(BUILT);
        const moved = await changeOnGitHub("tokens/color.json", "new");
        expect(await host.latest()).toBe(moved.sha);
    });
});

describe("a file at a commit", () => {
    it("is the file as it was at that commit, not as the branch has it now", async () => {
        const { host, changeOnGitHub } = acme();
        await changeOnGitHub("tokens/color.json", "changed since");
        expect(await host.file(BUILT, "tokens/color.json")).toBe("as built");
    });

    it("is undefined when the file isn't there", async () => {
        const { host } = acme();
        expect(await host.file(BUILT, "tokens/missing.json")).toBeUndefined();
    });
});

describe("a pull request", () => {
    it("commits the written and deleted files on a new branch from the commit it builds on", async () => {
        const { host, pulls, onBranch, lastCommit } = acme();
        await host.openPullRequest({ from: BUILT, ...changes });
        expect(pulls()[0]?.thread.branches?.head.ref).toMatch(OPENED_AT);
        expect(await onBranch("tokens/color.json")).toBe("mine");
        expect(await onBranch("tokens/old.json")).toBeUndefined();
        expect(lastCommit()?.parents).toStrictEqual([BUILT]);
        expect(lastCommit()?.message).toBe("color.brand changed");
    });

    it("builds on the commit it was given, though the branch has moved since", async () => {
        const { host, changeOnGitHub, lastCommit } = acme();
        await changeOnGitHub("tokens/color.json", "changed since");
        await host.openPullRequest({ from: BUILT, ...changes });
        expect(lastCommit()?.parents).toStrictEqual([BUILT]);
    });

    it("is committed as the person signed in, with no author of its own", async () => {
        const { host, lastCommit } = acme();
        await host.openPullRequest({ from: BUILT, ...changes });
        expect(lastCommit()?.author?.actor?.login).toBe("mark");
    });

    it("opens a pull request from the new branch into the branch, titled and described", async () => {
        const { host, pulls } = acme();
        const opened = await host.openPullRequest({ from: BUILT, ...changes });
        expect(pulls()[0]?.thread).toMatchObject({
            kind: "pull_request",
            title: "color.brand changed",
            body: "- color.brand changed",
            branches: {
                head: {
                    ref: expect.stringMatching(OPENED_AT),
                },
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
    it("is studio's prefix, the person, the time in UTC and a tag", () => {
        expect(pullRequestBranch("mark", new Date("2026-01-02T03:04:05Z"), "3fa9")).toBe(
            `${STUDIO_BRANCH_PREFIX}/mark/20260102-030405-3fa9`,
        );
    });

    it("differs between two pull requests opened in the same second", async () => {
        const { host, pulls } = acme();
        await host.openPullRequest({ from: BUILT, ...changes });
        await host.openPullRequest({ from: BUILT, ...changes });
        const heads = pulls().map(({ thread }) => thread.branches?.head.ref);
        expect(new Set(heads).size).toBe(2);
    });
});

describe("a host that can't answer", () => {
    it("says it couldn't be reached", async () => {
        const { forge, host } = acme();
        forge.offline();
        await expect(host.latest()).rejects.toThrow("Couldn't reach GitHub. Try again.");
        await expect(host.file(BUILT, "tokens/color.json")).rejects.toThrow(
            "Couldn't reach GitHub. Try again.",
        );
        await expect(host.openPullRequest({ from: BUILT, ...changes })).rejects.toThrow(
            "Couldn't reach GitHub. Try again.",
        );
    });

    it("says it couldn't be reached when the connection drops", async () => {
        const { forge, host } = acme();
        forge.failNext(
            "contents.getFile",
            () => new ForgeNetworkError("offline", { forge: "fake", instance: "fake.test" }),
        );
        await expect(host.file(BUILT, "tokens/color.json")).rejects.toThrow(
            "Couldn't reach GitHub. Try again.",
        );
    });

    it("says when to try again after too many requests, by the person's clock", async () => {
        const { forge, host } = acme();
        const resetAt = new Date(2026, 9, 23, 14, 5);
        forge.failNext(
            "contents.resolveRef",
            () =>
                new RateLimitedError("limited", 403, "", {
                    resetAt,
                    forge: "fake",
                    instance: "fake.test",
                }),
        );
        await expect(host.latest()).rejects.toThrow("Too many requests. Try again at 14:05.");
    });

    it("says to try again after too many requests when it doesn't say when", async () => {
        const { forge, host } = acme();
        forge.failNext(
            "contents.resolveRef",
            () =>
                new RateLimitedError("limited", 403, "", { forge: "fake", instance: "fake.test" }),
        );
        await expect(host.latest()).rejects.toThrow(/^Too many requests\. Try again\.$/);
    });
});

describe("a host that refuses", () => {
    const at = { forge: "fake", instance: "fake.test" } as const;

    it("says the key was refused when GitHub won't take it", async () => {
        const { forge, host } = acme();
        forge.failNext("contents.resolveRef", () => new TokenRevokedError("bad key", 401, "", at));
        await expect(host.latest()).rejects.toBeInstanceOf(KeyRefused);
    });

    it("says it refused, for studio to ask what the person may do now, on a 403", async () => {
        const { forge, host } = acme();
        forge.failNext(
            "contents.commitFiles",
            () => new ForbiddenError("no", 403, "", "unknown", at),
        );
        await expect(host.openPullRequest({ from: BUILT, ...changes })).rejects.toBeInstanceOf(
            Refused,
        );
    });

    it("says it refused when the repository can't be seen", async () => {
        const { forge, host } = acme();
        forge.failNext("contents.resolveRef", () => new NotFoundError("gone", 404, "", at));
        await expect(host.latest()).rejects.toBeInstanceOf(Refused);
    });

    it("asks for the company's single sign-on when that is why", async () => {
        const { forge, host } = acme();
        forge.failNext(
            "contents.resolveRef",
            () => new ForbiddenError("sso", 403, "", "sso_required", at),
        );
        const refused = host.latest();
        await expect(refused).rejects.toBeInstanceOf(UserFacingError);
        await expect(refused).rejects.toThrow(
            "Sign in to acme with single sign-on, then try again.",
        );
    });

    it("says the app needs a permission when it lacks one", async () => {
        const { forge, host } = acme();
        forge.failNext(
            "contents.commitFiles",
            () => new InsufficientScopeError("scope", 403, "", at),
        );
        const refused = host.openPullRequest({ from: BUILT, ...changes });
        await expect(refused).rejects.toBeInstanceOf(UserFacingError);
        await expect(refused).rejects.toThrow(
            "studio's GitHub App needs permission to write to acme/site.",
        );
    });

    it("words a connection failure as studio's own line", async () => {
        const { forge, host } = acme();
        forge.offline();
        await expect(host.latest()).rejects.toBeInstanceOf(UserFacingError);
    });
});
