import { setValue } from "@sugarcube-sh/dtcg-edit";
import { ForbiddenError, TokenRevokedError } from "forges";
import { describe, expect, it } from "vitest";
import { adapterFor } from "../../src/adapters";
import { encodeEdits } from "../../src/controllers/edits-text";
import { keepUnsaved } from "../../src/controllers/unsaved";
import {
    barMessages,
    type Page,
    type SignInState,
    createSignIn,
    pressSaveWith,
    saveFor,
    saveOffer,
    signedInAs,
} from "../../src/controllers/sign-in";
import { createStudio } from "../../src/controllers/studio";
import type { Access } from "../../src/git-hosts/git-host";
import { STUDIO_COOKIES, STUDIO_SIGN_IN_BASE, STUDIO_STORAGE } from "../../src/studio-names";
import { fakeGitHub } from "../git-hosts/fake-github";
import { demoMessage } from "./demo-message";

const darkText = { input: { mode: "dark" } } as const;
const WAITING = `${STUDIO_STORAGE.saveWaiting}tokens/tokens.resolver.json`;
const PAGE = "/docs/colours?tab=dark#brand";

function page({ signedIn = true, key = "ghu_one", refreshes = true } = {}) {
    const cookies = new Map<string, string>();
    if (signedIn) cookies.set(STUDIO_COOKIES.login, "mark");
    if (signedIn && key) cookies.set(STUDIO_COOKIES.key, key);
    const stored = new Map<string, string>();
    const asked: Array<{ url: string; method: string | undefined }> = [];
    const went: string[] = [];
    const fake: Page = {
        cookie: (name) => cookies.get(name),
        here: () => PAGE,
        go: (url) => went.push(url),
        storage: {
            getItem: (name) => stored.get(name) ?? null,
            setItem: (name, value) => stored.set(name, value),
            removeItem: (name) => stored.delete(name),
        },
        fetch: async (url, init) => {
            asked.push({ url, method: init.method });
            if (url.endsWith("/refresh") && refreshes) {
                cookies.set(STUDIO_COOKIES.key, "ghu_fresh");
                return new Response(null, { status: 200 });
            }
            if (url.endsWith("/sign-out")) {
                cookies.clear();
                return new Response(null, { status: 204 });
            }
            return new Response(null, { status: 401 });
        },
    };
    return { page: fake, cookies, stored, asked, went };
}

function setUp({
    signedIn = true,
    key = "ghu_one",
    refreshes = true,
    access = { can: "write" } as Access,
} = {}) {
    const message = demoMessage();
    const github = fakeGitHub(
        Object.fromEntries(Object.entries(message.files).map(([file, t]) => [`tokens/${file}`, t])),
    );
    const at = page({ signedIn, key, refreshes });
    const keys: string[] = [];
    let accessAsked = 0;
    let answer = access;
    const signIn = createSignIn({
        page: at.page,
        repository: "acme/site",
        entry: "tokens/tokens.resolver.json",
        hostFor: (login, keyNow) => ({
            ...github.host,
            latest: async () => {
                keys.push(`${login}:${await keyNow()}`);
                return github.host.latest();
            },
            access: async () => {
                await keyNow();
                accessAsked++;
                return answer;
            },
        }),
    });
    const studio = createStudio(message, adapterFor, signIn.save);
    const edit = () =>
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkText),
        );
    return {
        ...at,
        github,
        signIn,
        studio,
        edit,
        keys,
        accessAsked: () => accessAsked,
        answerWith: (next: Access) => (answer = next),
    };
}

describe("someone who isn't signed in", () => {
    it("is shown as no one, and nothing is asked of anyone", async () => {
        const { signIn, studio, asked } = setUp({ signedIn: false });
        await signIn.start(studio);
        expect(signIn.state.person).toBeUndefined();
        expect(asked).toStrictEqual([]);
    });

    it("goes to sign in on Save, to come back to this page, with the save waiting", async () => {
        const { signIn, studio, edit, went, stored } = setUp({ signedIn: false });
        edit();
        await signIn.pressSave(studio);
        expect(went).toStrictEqual([
            `${STUDIO_SIGN_IN_BASE}/sign-in?return=${encodeURIComponent(PAGE)}`,
        ]);
        expect(stored.get(WAITING)).toBe(await encodeEdits(studio.unsaved));
    });
});

describe("coming back from GitHub", () => {
    it("carries the save on by itself when the edits are the ones that were waiting", async () => {
        const { signIn, studio, edit, stored, github } = setUp();
        edit();
        stored.set(WAITING, await encodeEdits(studio.unsaved));
        await signIn.start(studio);
        expect(github.pulls()).toHaveLength(1);
        expect(studio.state.saved).toMatchObject({ pullRequest: { number: 1 } });
        expect(stored.has(WAITING)).toBe(false);
    });

    it("carries the save on after a real reload, with the edits kept and restored as studio does", async () => {
        const before = setUp({ signedIn: false });
        before.edit();
        const unsaved = `${STUDIO_STORAGE.unsaved}tokens/tokens.resolver.json`;
        await keepUnsaved(before.studio, before.page.storage!, unsaved);
        before.studio.do(
            setValue(
                before.studio.state.tokens,
                "color.text.muted",
                "{color.neutral.300}",
                darkText,
            ),
        );
        await new Promise((resolve) => setTimeout(resolve, 10));
        await before.signIn.pressSave(before.studio);

        const after = setUp();
        for (const [name, value] of before.stored) after.stored.set(name, value);
        await keepUnsaved(after.studio, after.page.storage!, unsaved);
        await after.signIn.start(after.studio);

        expect(after.github.pulls()).toHaveLength(1);
        expect(after.studio.state.changes).toStrictEqual([]);
    });

    it("doesn't carry on when the edits aren't the ones that were waiting", async () => {
        const { signIn, studio, edit, stored, github } = setUp();
        stored.set(WAITING, "other edits");
        edit();
        await signIn.start(studio);
        expect(github.pulls()).toStrictEqual([]);
        expect(stored.has(WAITING)).toBe(false);
    });

    it("doesn't carry on for someone who can't save, and says why instead", async () => {
        const { signIn, studio, edit, stored, github } = setUp({ access: { can: "read" } });
        edit();
        stored.set(WAITING, await encodeEdits(studio.unsaved));
        await signIn.start(studio);
        expect(github.pulls()).toStrictEqual([]);
        expect(saveFor(signIn)).toStrictEqual({
            canSave: false,
            reason: "You can't save to acme/site.",
        });
    });

    it("says the sign-in didn't finish when it comes back signed out, keeping the edits", async () => {
        const { signIn, studio, edit, stored } = setUp({ signedIn: false });
        edit();
        stored.set(WAITING, await encodeEdits(studio.unsaved));
        await signIn.start(studio);
        expect(signIn.state.said).toBe("Not signed in. Try again.");
        expect(studio.state.changes).toHaveLength(1);
        expect(stored.has(WAITING)).toBe(false);
    });
});

describe("someone signed in", () => {
    it("is shown by name from the cookie, with no request for it", () => {
        const { signIn, asked } = setUp();
        expect(signIn.state.person).toBe("mark");
        expect(asked).toStrictEqual([]);
    });

    it("is asked about once, at the start, for what they may do", async () => {
        const { signIn, studio, accessAsked } = setUp({ access: { can: "read" } });
        await signIn.start(studio);
        expect(signIn.state.access).toStrictEqual({ can: "read" });
        expect(accessAsked()).toBe(1);
    });

    it("saves straight away on Save, with their key", async () => {
        const { signIn, studio, edit, went, keys, github } = setUp();
        await signIn.start(studio);
        edit();
        await signIn.pressSave(studio);
        expect(went).toStrictEqual([]);
        expect(keys).toStrictEqual(["mark:ghu_one"]);
        expect(github.pulls()).toHaveLength(1);
    });

    it("gets a new key first when theirs has run out", async () => {
        const { signIn, studio, asked } = setUp({ key: "" });
        await signIn.start(studio);
        expect(asked).toStrictEqual([{ url: `${STUDIO_SIGN_IN_BASE}/refresh`, method: "POST" }]);
        expect(signIn.state.access).toStrictEqual({ can: "write" });
    });

    it("gets a new key and tries once more when GitHub refuses theirs", async () => {
        const { signIn, studio, edit, github, keys } = setUp();
        await signIn.start(studio);
        edit();
        const revoked = new TokenRevokedError("bad key", 401, "", { forge: "fake" });
        github.forge.failNext("contents.resolveRef", () => revoked);
        await signIn.pressSave(studio);
        expect(keys).toStrictEqual(["mark:ghu_one", "mark:ghu_fresh"]);
        expect(github.pulls()).toHaveLength(1);
    });

    it("is signed out, with the edits kept, when no new key can be had", async () => {
        const { signIn, studio, edit, github } = setUp({ refreshes: false });
        await signIn.start(studio);
        edit();
        const revoked = new TokenRevokedError("bad key", 401, "", { forge: "fake" });
        github.forge.failNext("contents.resolveRef", () => revoked);
        await signIn.pressSave(studio);
        expect(studio.state.saved).toStrictEqual({ failed: "Not signed in. Try again." });
        expect(signIn.state.person).toBeUndefined();
        expect(studio.state.changes).toHaveLength(1);
    });

    it("asks again what they may do when GitHub refuses the save, and says that", async () => {
        const { signIn, studio, edit, github, answerWith } = setUp();
        await signIn.start(studio);
        edit();
        answerWith({ can: "read" });
        github.forge.failNext(
            "contents.commitFiles",
            () => new ForbiddenError("no", 403, "", "unknown", { forge: "fake" }),
        );
        await signIn.pressSave(studio);
        expect(signIn.state.access).toStrictEqual({ can: "read" });
        expect(barMessages(studio.state.saved, saveFor(signIn))).toStrictEqual({
            reason: "You can't save to acme/site.",
        });
    });

    it("is forgotten on signing out", async () => {
        const { signIn, studio, asked } = setUp();
        await signIn.start(studio);
        await signIn.signOut();
        expect(asked).toStrictEqual([{ url: `${STUDIO_SIGN_IN_BASE}/sign-out`, method: "POST" }]);
        expect(signIn.state).toMatchObject({ person: undefined, access: undefined });
    });

    it("tells whoever is listening when what is known changes", async () => {
        const { signIn, studio } = setUp();
        let told = 0;
        signIn.subscribe(() => told++);
        await signIn.start(studio);
        expect(told).toBeGreaterThan(0);
    });
});

describe("what the change bar offers", () => {
    const state = (change: Partial<SignInState>): SignInState => ({
        person: "mark",
        access: { can: "write" },
        said: undefined,
        ...change,
    });

    it("offers Save to someone signed out, as the way to sign in", () => {
        expect(
            saveOffer(state({ person: undefined, access: undefined }), "acme/site"),
        ).toStrictEqual({ canSave: true });
    });

    it("offers Save to someone who can write", () => {
        expect(saveOffer(state({}), "acme/site")).toStrictEqual({ canSave: true });
    });

    it("waits to offer Save until it knows what someone signed in may do", () => {
        expect(saveOffer(state({ access: undefined }), "acme/site")).toStrictEqual({
            canSave: false,
        });
    });

    it("says why someone who can only read can't save", () => {
        expect(saveOffer(state({ access: { can: "read" } }), "acme/site")).toStrictEqual({
            canSave: false,
            reason: "You can't save to acme/site.",
        });
        expect(
            saveOffer(state({ access: { can: "nothing", reason: "no-access" } }), "acme/site"),
        ).toStrictEqual({ canSave: false, reason: "You can't save to acme/site." });
    });

    it("says the app isn't installed, with the link when there is one", () => {
        const install = "https://github.com/apps/acme-studio/installations/new";
        expect(
            saveOffer(
                state({ access: { can: "nothing", reason: "not-installed", install } }),
                "acme/site",
            ),
        ).toStrictEqual({
            canSave: false,
            reason: "studio isn't installed on acme/site.",
            install,
        });
        expect(
            saveOffer(state({ access: { can: "nothing", reason: "not-installed" } }), "acme/site"),
        ).toStrictEqual({ canSave: false, reason: "studio isn't installed on acme/site." });
    });

    it("says what went wrong signing in", () => {
        expect(
            saveOffer(
                state({ person: undefined, access: undefined, said: "Not signed in. Try again." }),
                "acme/site",
            ),
        ).toStrictEqual({ canSave: true, reason: "Not signed in. Try again." });
    });
});

describe("studio with no sign-in, as on a developer's computer", () => {
    it("offers Save as it always has, and saves straight to the host", async () => {
        const saved: string[] = [];
        const studio = createStudio(demoMessage(), adapterFor, async () => {
            saved.push("saved");
            return { written: [], deleted: [] };
        });
        expect(saveFor(undefined)).toStrictEqual({ canSave: true });
        expect(signedInAs(undefined)).toBeUndefined();
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkText),
        );
        await pressSaveWith(studio, undefined);
        expect(saved).toStrictEqual(["saved"]);
    });
});

describe("studio with a sign-in", () => {
    it("asks the sign-in what Save does and who is signed in", async () => {
        const { signIn, studio, edit, went } = setUp({ signedIn: false });
        expect(signedInAs(signIn)).toBeUndefined();
        expect(saveFor(signIn)).toStrictEqual({ canSave: true });
        edit();
        await pressSaveWith(studio, signIn);
        expect(went).toHaveLength(1);
    });

    it("names the person and gives the repository's reasons", async () => {
        const { signIn, studio } = setUp({ access: { can: "read" } });
        await signIn.start(studio);
        expect(signedInAs(signIn)).toBe("mark");
        expect(saveFor(signIn)).toStrictEqual({
            canSave: false,
            reason: "You can't save to acme/site.",
        });
    });
});

describe("what the change bar says", () => {
    const failed = { failed: "Save failed: Resource not accessible by integration" };
    const pullRequest = { pullRequest: { number: 7 }, files: {} };

    it("says the save's result when nothing stands in the way of saving", () => {
        expect(barMessages(pullRequest, { canSave: true })).toStrictEqual({ outcome: pullRequest });
        expect(barMessages(failed, { canSave: true })).toStrictEqual({ outcome: failed });
    });

    it("says why Save isn't possible instead of a failure that led to finding out", () => {
        expect(
            barMessages(failed, { canSave: false, reason: "You can't save to acme/site." }),
        ).toStrictEqual({ reason: "You can't save to acme/site." });
    });

    it("says both a result and the reason when the result isn't a failure", () => {
        const install = "https://github.com/apps/acme-studio/installations/new";
        expect(
            barMessages(pullRequest, {
                canSave: false,
                reason: "studio isn't installed on acme/site.",
                install,
            }),
        ).toStrictEqual({
            outcome: pullRequest,
            reason: "studio isn't installed on acme/site.",
            install,
        });
    });

    it("says nothing when there is nothing to say", () => {
        expect(barMessages(undefined, { canSave: true })).toStrictEqual({});
    });
});
