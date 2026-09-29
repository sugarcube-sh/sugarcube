// Generates padding utility classes (`.p-sm`, `.p-md` and so on), one for each token in the `space`
// group.
import { tokensIn, defaultPermutation, type Document } from "@sugarcube-sh/dtcg";

declare const doc: Document;
declare function cssName(path: string): string;

const base = defaultPermutation(doc)?.input;
for (const t of tokensIn(doc, "space", base)) {
    if (t.type !== "dimension") continue;
    const suffix = t.path.slice("space.".length).replaceAll(".", "-");
    row(`.p-${suffix} { padding: var(--${cssName(t.path)}); }`);
}
