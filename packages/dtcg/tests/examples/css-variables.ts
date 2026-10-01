// Turns tokens into CSS custom properties. Each theme gets a block with only the values that differ
// from the default. Private tokens aren't output, and references to them are written as their
// value.
import {
    defaultPermutation,
    token,
    sameValue,
    isAlias,
    type Document,
    type Permutation,
    type Token,
} from "@sugarcube-sh/dtcg";

declare const doc: Document;
declare function cssName(path: string): string;
declare function selectorFor(p: Permutation): string;
declare function renderLiteral(token: Token): string;

function isPrivate(p: Permutation, t: Token): boolean {
    const ext = p.sources[t.source.index]?.extensions?.["sh.sugarcube"] as
        | { emit?: boolean }
        | undefined;
    return ext?.emit === false;
}

function declaration(p: Permutation, t: Token): string {
    if (isAlias(t.value)) {
        const target = token(doc, t.value.alias, p.input);
        if (target && !isPrivate(p, target)) return `var(--${cssName(target.path)})`;
    }
    return renderLiteral(t);
}

const base = defaultPermutation(doc);
for (const p of doc.permutations) {
    const lines: string[] = [];
    for (const t of p.tokens) {
        if (t.invalid || isPrivate(p, t)) continue;
        const inBase = base && token(doc, t.path, base.input);
        const same = p !== base && inBase !== undefined && sameValue(inBase, t);
        if (same) continue;
        lines.push(`  --${cssName(t.path)}: ${declaration(p, t)};`);
    }
    if (lines.length) row(`${selectorFor(p)} {\n${lines.join("\n")}\n}`);
}
