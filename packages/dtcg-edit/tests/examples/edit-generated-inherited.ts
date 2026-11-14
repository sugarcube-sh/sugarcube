// Editing a token made by a generator, and a token a group takes through `$extends`. Each is
// refused with the reason: a generated token is turned into an ordinary one first, and an
// inherited one is changed in the group it comes from.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { commit, detach, setValue } from "@sugarcube-sh/dtcg-edit";

declare let tokens: DesignTokens;

const step = setValue(tokens, "space.md", { value: 18, unit: "px" });
if (step.refusal?.kind === "generated") {
    const done = commit(tokens, detach(tokens, "space.md"));
    if (done.tokens) tokens = done.tokens;
}

const padding = setValue(tokens, "primary.padding", "{space.lg}");
if (padding.refusal?.kind === "inherited") {
    const original = `${padding.refusal.from}.padding`;
    const done = commit(tokens, setValue(tokens, original, "{space.lg}"));
    if (done.tokens) tokens = done.tokens;
}
