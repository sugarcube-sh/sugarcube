// A sidebar tree of groups and tokens, nested, in the order the files list them.
import { type DesignTokens, type Group, type Token } from "@sugarcube-sh/dtcg";

declare const tokens: DesignTokens;

type Node = { path: string; token: boolean; children: Node[] };

function node(child: Token | Group): Node {
    if (child.kind === "token") return { path: child.path, token: true, children: [] };
    return { path: child.path, token: false, children: child.children.map(node) };
}

export const tree = tokens.getPermutation().children.map(node);
