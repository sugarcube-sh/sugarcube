import { describe, expect, it } from "vitest";
import type { Page } from "../../src/controllers/sign-in";
import { pickSave } from "../../src/host/save";
import type { GitSaveSettings, SaveOutcome } from "../../src/protocol";
import { STUDIO_COOKIES } from "../../src/studio-names";
import { studioOn } from "../controllers/demo-message";

const gitSave: GitSaveSettings = {
    host: "github",
    repository: "acme/site",
    branch: "main",
    entry: "tokens/tokens.resolver.json",
    signIn: "/auth/studio",
};

function page(cookies: Record<string, string> = {}) {
    const went: string[] = [];
    const fake: Page = {
        cookie: (name) => cookies[name],
        here: () => "/docs",
        go: (url) => went.push(url),
        storage: undefined,
        fetch: async () => new Response(null, { status: 401 }),
    };
    return { page: fake, went };
}

const call = async (): Promise<SaveOutcome> => ({ written: [], deleted: [] });

describe("which save studio has", () => {
    it("saves through the server when there is one, whatever the build says", () => {
        expect(pickSave({ live: true, call, gitSave, page: page().page })).toStrictEqual({
            save: call,
        });
    });

    it("saves to GitHub, signing in, when there's no server and the build says where the tokens live", () => {
        const { save, signIn } = pickSave({ live: false, call, gitSave, page: page().page });
        expect(signIn?.repository).toBe("acme/site");
        expect(save).toBe(signIn?.save);
    });

    it("sends the person to the sign-in function the build names", async () => {
        const at = page();
        const { signIn } = pickSave({ live: false, call, gitSave, page: at.page });
        const studio = studioOn();
        await signIn?.pressSave(studio);
        expect(at.went[0]).toMatch(/^\/auth\/studio\/sign-in\?return=/);
    });

    it("knows who is signed in from the page's cookie", () => {
        const { signIn } = pickSave({
            live: false,
            call,
            gitSave,
            page: page({ [STUDIO_COOKIES.login]: "mark" }).page,
        });
        expect(signIn?.state.person).toBe("mark");
    });

    it("has no save and no sign-in when there's no server and the build gives nowhere to save", () => {
        expect(pickSave({ live: false, call, page: page().page })).toStrictEqual({});
    });
});
