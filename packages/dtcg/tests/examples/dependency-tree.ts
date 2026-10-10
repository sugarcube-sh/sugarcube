// Prints a tree of everything a token depends on, all the way down.
import { dependencies, defaultPermutation, type Document } from "@sugarcube-sh/dtcg";

declare const doc: Document;

const base = defaultPermutation(doc);

function tree(path: string, depth = 0): void {
    row(`${"  ".repeat(depth)}${path}`);
    if (!base) return;
    for (const dep of dependencies(base, path)) tree(dep.path, depth + 1);
}
tree("button.primary.background");
