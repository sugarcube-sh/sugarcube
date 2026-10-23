import type { Edits } from "@sugarcube-sh/dtcg-edit";
import { type Page, type SignIn, createSignIn } from "../controllers/sign-in";
import { githubHost } from "../git-hosts/github";
import type { GitSaveSettings, SaveOutcome, StudioSave } from "../protocol";

export function pickSave({
    live,
    call,
    gitSave,
    page,
}: {
    live: boolean;
    call: (edits: Edits) => Promise<SaveOutcome>;
    gitSave?: GitSaveSettings | undefined;
    page: Page;
}): { save?: StudioSave; signIn?: SignIn } {
    if (live) return { save: call };
    if (!gitSave) return {};
    const { repository, branch, entry, signIn: base, install } = gitSave;
    const signIn = createSignIn({
        page,
        repository,
        entry,
        base,
        hostFor: (login, key) => githubHost({ key, repository, branch, login, install }),
    });
    return { save: signIn.save, signIn };
}
