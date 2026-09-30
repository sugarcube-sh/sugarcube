// A token's detail page. It shows the value as written, then each theme that overrides it, with the
// file each value comes from.
import { acrossPermutations, defaultPermutation, type Document } from "@sugarcube-sh/dtcg";

declare const doc: Document;
const path = "color.danger";

const base = defaultPermutation(doc)?.tokens[path];
row("Base", base?.authored?.value, base?.source.at.file);

for (const { input, label, token, overrides } of acrossPermutations(doc, path)) {
    if (overrides) row(label, token.authored?.value, token.source.at.file, JSON.stringify(input));
}
