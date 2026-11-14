import type { Edits } from "@sugarcube-sh/dtcg-edit";
import { type Page, type SignIn, createSignIn } from "../controllers/sign-in";
import { createGitHubHost } from "../git-hosts/github";
import type { GitSaveSettings, SaveResult, StudioSave } from "../protocol";

export function pickSave({
    live,
    saveOnHost,
    gitSave,
    page,
}: {
    live: boolean;
    saveOnHost: (edits: Edits) => Promise<SaveResult>;
    gitSave?: GitSaveSettings | undefined;
    page: Page;
}): { save?: StudioSave; signIn?: SignIn } {
    if (live) return { save: saveOnHost };
    if (!gitSave) return {};
    const { repository, branch, entry, signIn: signInBase, install } = gitSave;
    const signIn = createSignIn({
        page,
        repository,
        entry,
        base: signInBase,
        createHost: (login, key) =>
            createGitHubHost({ key, repository, branch, login, installURL: install }),
    });
    return { save: signIn.save, signIn };
}
