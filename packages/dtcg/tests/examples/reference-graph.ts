// Builds a map of which tokens reference which, and in which themes, then counts the tokens nothing
// references.
import type { Document, Input } from "@sugarcube-sh/dtcg";

declare const doc: Document;

const edges = new Map<string, { from: string; to: string; in: Input[] }>();
for (const e of doc.graph) {
    const key = `${e.from}\u0000${e.to}`;
    const input = doc.permutations[e.permutation]?.input;
    if (!input) continue;
    const existing = edges.get(key);
    if (existing) existing.in.push(input);
    else edges.set(key, { from: e.from, to: e.to, in: [input] });
}
const unusedPrimitives = Object.keys(doc.permutations[0]?.tokens ?? {}).filter(
    (path) => ![...edges.values()].some((e) => e.to === path),
);
row(edges.size, unusedPrimitives.length);
