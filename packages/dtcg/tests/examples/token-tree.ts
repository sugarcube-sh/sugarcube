// A sidebar tree of groups and tokens, nested, in the order the files list them.
import { defaultPermutation, type Document } from "@sugarcube-sh/dtcg";

declare const doc: Document;

type Node = { name: string; path: string; token: boolean; children: Node[] };
const root: Node = { name: "", path: "", token: false, children: [] };
const p = defaultPermutation(doc);

function place(path: string, token: boolean): void {
    let at = root;
    const parts = path.split(".");
    parts.forEach((name, i) => {
        const sub = parts.slice(0, i + 1).join(".");
        let child = at.children.find((c) => c.path === sub);
        if (!child) {
            child = { name, path: sub, token: token && i === parts.length - 1, children: [] };
            at.children.push(child);
        }
        at = child;
    });
}
for (const path of Object.keys(p?.groups ?? {})) place(path, false);
for (const path of Object.keys(p?.tokens ?? {})) place(path, true);
