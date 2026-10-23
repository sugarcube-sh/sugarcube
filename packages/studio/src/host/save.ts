import type { Edits } from "@sugarcube-sh/dtcg-edit";
import { pullRequestText } from "../controllers/git-save";
import type { SaveOutcome, SaveTo, StudioSave } from "../protocol";

export function pickSave({
    live,
    call,
    saveTo,
}: {
    live: boolean;
    call: (edits: Edits) => Promise<SaveOutcome>;
    saveTo?: SaveTo | undefined;
}): StudioSave | undefined {
    if (live) return call;
    return saveTo ? pullRequestSave(saveTo) : undefined;
}

export function pullRequestSave({ url, entry }: SaveTo): StudioSave {
    return async (edits, changes) => {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...pullRequestText(changes), entry, edits }),
        });
        const body = await response.json().catch(() => undefined);
        if (body && (response.status === 201 || response.status === 409))
            return body as SaveOutcome;
        throw new Error(body?.error ?? `The save was refused (${response.status})`);
    };
}
