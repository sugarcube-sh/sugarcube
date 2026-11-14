// Moves the semantic colors out of `colors.json` into a new `semantic.json`, as one step. Their
// names don't change.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { addFile, combine, commit, move } from "@sugarcube-sh/dtcg-edit";

declare let tokens: DesignTokens;

const done = commit(
    tokens,
    combine(tokens, [
        (current) =>
            addFile(current, "semantic.json", { to: { set: "base" }, after: "colors.json" }),
        ...["color.danger", "color.success", "color.warning"].map(
            (path) => (current: DesignTokens) => move(current, path, { file: "semantic.json" }),
        ),
    ]),
);
if (done.tokens) tokens = done.tokens;
else if (done.refusal) showMessage(done.refusal.reason);
