// Checks a config that maps each theme to a CSS selector. Any entry that matches no theme in the
// tokens is reported.
import { permutation, type Document, type Input } from "@sugarcube-sh/dtcg";

declare const doc: Document;
declare const config: { permutations: { input: Input; selector: string; atRule?: string }[] };

for (const entry of config.permutations) {
    const p = permutation(doc, entry.input);
    if (!p) {
        showMessage(`No permutation matches ${JSON.stringify(entry.input)}`);
        continue;
    }
    row(entry.selector, p.label, Object.keys(p.tokens).length);
}
