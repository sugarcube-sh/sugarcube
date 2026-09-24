import type { PathIndex } from "./path-index";
import { isRootPath, stripRoot } from "./paths";

/**
 * A node in the token document — a group or a token. D-036: the document's own
 * shape is the information architecture, so this tree is the navigation.
 */
export type TokenNode = {
    /** Dot path from the document root. The URL is this with dots as slashes. */
    path: string;
    /** The final segment. */
    name: string;
    /** How it reads in the tree. */
    title: string;
    /** Tokens at or beneath this node. A token counts one. */
    count: number;
    /** Empty when this node is a token. */
    children: TokenNode[];
    /** A group carrying its own value, via a `$root` token (DTCG §6.2). */
    hasValue?: boolean;
};

export type GroupPresentation = {
    /** Overrides the derived title, keyed by path. */
    labels?: Record<string, string>;
    /** Top-level groups that exist but are plumbing rather than part of the system. */
    hidden?: readonly string[];
};

export function isLeaf(node: TokenNode): boolean {
    return node.children.length === 0;
}

/** Insertion-ordered, so the tree comes out in document order at every depth. */
type Draft = { name: string; children: Map<string, Draft>; hasValue?: boolean };

export function buildTree(pathIndex: PathIndex, presentation: GroupPresentation = {}): TokenNode[] {
    const { labels = {}, hidden = [] } = presentation;
    const roots = new Map<string, Draft>();

    const place = (handle: string) => {
        const path = pathIndex.pathOf(handle);
        if (path === undefined) return;

        const segments = stripRoot(path).split(".");
        const [root] = segments;
        if (!root || hidden.includes(root)) return;

        let draft: Draft | undefined;
        let level = roots;
        for (const segment of segments) {
            draft = level.get(segment);
            if (!draft) {
                draft = { name: segment, children: new Map() };
                level.set(segment, draft);
            }
            level = draft.children;
        }

        if (draft && isRootPath(path)) draft.hasValue = true;
    };

    for (const [handle] of pathIndex.groupEntries()) place(handle);
    for (const [handle] of pathIndex.entries()) place(handle);

    return Array.from(roots.values(), (draft) => finish(draft, draft.name, labels));
}

function finish(draft: Draft, path: string, labels: Record<string, string>): TokenNode {
    const children = Array.from(draft.children.values(), (child) =>
        finish(child, `${path}.${child.name}`, labels),
    );
    const own = draft.hasValue ? 1 : 0;
    return {
        path,
        name: draft.name,
        title: labels[path] ?? draft.name,
        count: children.length
            ? own + children.reduce((total, child) => total + child.count, 0)
            : 1,
        children,
        ...(draft.hasValue ? { hasValue: true } : {}),
    };
}
