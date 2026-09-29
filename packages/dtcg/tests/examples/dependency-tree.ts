// Prints a tree of everything a token depends on, all the way down.
import { dependencies, defaultPermutation, type Document } from "@sugarcube-sh/dtcg";

declare const doc: Document;

function tree(path: string, depth = 0): void {
    row(`${"  ".repeat(depth)}${path}`);
    const base = defaultPermutation(doc)?.input;
    for (const dep of dependencies(doc, path, base)) tree(dep.path, depth + 1);
}
tree("button.primary.background");
