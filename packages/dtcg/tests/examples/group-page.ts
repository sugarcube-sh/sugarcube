// A group's page in a token editor: its subgroups, with how many tokens each holds, then its own
// tokens, with the value as written, the file it's in, and each theme that overrides it.
import {
    acrossPermutations,
    defaultPermutation,
    tokensIn,
    type Document,
} from "@sugarcube-sh/dtcg";

declare const doc: Document;
const path = "color";

const base = defaultPermutation(doc);
const isChild = (p: string) => p.startsWith(`${path}.`) && !p.slice(path.length + 1).includes(".");

for (const group of Object.values(base?.groups ?? {})) {
    if (isChild(group.path)) row(group.path, tokensIn(doc, group.path).length);
}

for (const t of Object.values(base?.tokens ?? {})) {
    if (!isChild(t.path)) continue;
    const overrides = acrossPermutations(doc, t.path)
        .filter((p) => p.overrides)
        .map((p) => `${p.label} in ${p.token.source.at.file}`);
    row(t.path, t.authored?.value, t.source.at.file, overrides.join(", "));
}
