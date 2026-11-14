import { describe, expect, it } from "vitest";
import type { Page } from "../../src/controllers/sign-in";
import { pickSave } from "../../src/host/save";
import type { GitSaveSettings, SaveResult } from "../../src/protocol";
import { STUDIO_COOKIES } from "../../src/studio-names";
import { createDemoStudio } from "../controllers/demo-message";

const gitSave: GitSaveSettings = {
    host: "github",
    repository: "acme/site",
    branch: "main",
    entry: "tokens/tokens.resolver.json",
    signIn: "/auth/studio",
};

function fakePage(cookies: Record<string, string> = {}) {
    const went: string[] = [];
    const fake: Page = {
        getCookie: (name) => cookies[name],
        getReturnPath: () => "/docs",
        redirect: (url) => went.push(url),
        storage: undefined,
        fetch: async () => new Response(null, { status: 401 }),
    };
    return { page: fake, went };
}

const call = async (): Promise<SaveResult> => ({ savedFiles: [], deleted: [] });

describe("which save studio has", () => {
    it("saves through the server when there is one, whatever the build says", () => {
        expect(
            pickSave({ live: true, saveOnHost: call, gitSave, page: fakePage().page }),
        ).toStrictEqual({
            save: call,
        });
    });

    it("saves to GitHub, signing in, when there's no server and the build says where the tokens live", () => {
        const { save, signIn } = pickSave({
            live: false,
            saveOnHost: call,
            gitSave,
            page: fakePage().page,
        });
        expect(signIn?.repository).toBe("acme/site");
        expect(save).toBe(signIn?.save);
    });

    it("sends the person to the sign-in function the build names", async () => {
        const at = fakePage();
        const { signIn } = pickSave({ live: false, saveOnHost: call, gitSave, page: at.page });
        const studio = createDemoStudio();
        await signIn?.pressSave(studio);
        expect(at.went[0]).toMatch(/^\/auth\/studio\/sign-in\?return=/);
    });

    it("knows who is signed in from the page's cookie", () => {
        const { signIn } = pickSave({
            live: false,
            saveOnHost: call,
            gitSave,
            page: fakePage({ [STUDIO_COOKIES.login]: "mark" }).page,
        });
        expect(signIn?.state.login).toBe("mark");
    });

    it("has no save and no sign-in when there's no server and the build gives nowhere to save", () => {
        expect(pickSave({ live: false, saveOnHost: call, page: fakePage().page })).toStrictEqual(
            {},
        );
    });
});
