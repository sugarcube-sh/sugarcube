// Builds a map of which tokens reference which, and in which themes, then counts the tokens nothing
// references.
import type { Document, Input } from "@sugarcube-sh/dtcg";

declare const doc: Document;

const edges = new Map<string, { from: string; to: string; in: Input[] }>();
for (const permutation of doc.permutations) {
    for (const e of permutation.edges) {
        const key = `${e.from}\u0000${e.to}`;
        const existing = edges.get(key);
        if (existing) existing.in.push(permutation.input);
        else edges.set(key, { from: e.from, to: e.to, in: [permutation.input] });
    }
}
const unusedPrimitives = (doc.permutations[0]?.tokens ?? []).filter(
    (t) => ![...edges.values()].some((e) => e.to === t.path),
);
row(edges.size, unusedPrimitives.length);
