// A group's page in a token editor: its subgroups, with how many tokens each holds, then its own
// tokens, with the value as written, the file it's in, and each theme that overrides it.
import { type DesignTokens } from "@sugarcube-sh/dtcg";

declare const tokens: DesignTokens;
const path = "color";

const group = tokens.getPermutation().getGroup(path);

for (const child of group?.children ?? []) {
    if (child.kind === "group") row(child.path, child.tokens.length);
}

for (const t of group?.childTokens ?? []) {
    const overrides = tokens
        .getDefinitions(t.path)
        .filter(({ sources }) => sources.some(({ modifier }) => modifier))
        .map(({ winningPermutations, span }) => `${winningPermutations.label} in ${span.file}`);
    row(t.path, t.original?.value, t.winningDefinition.source.file, overrides.join(", "));
}
