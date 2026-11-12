import { tokenPath } from "../path.js";
import type { Merged } from "./merge.js";

export function sortByDocumentOrder(merged: Merged): void {
    const { tokens, groups, order } = merged;
    const children = new Map<string | undefined, string[]>();
    const addToParent = (path: string) => {
        const parent = tokenPath.getParent(path);
        const siblings = children.get(parent);
        if (siblings) siblings.push(path);
        else children.set(parent, [path]);
    };
    for (const path of order) if (tokens.has(path) || groups.has(path)) addToParent(path);

    const orderedTokens: Merged["tokens"] = new Map();
    const orderedGroups: Merged["groups"] = new Map();
    const visit = (parent: string | undefined) => {
        for (const path of children.get(parent) ?? []) {
            const token = tokens.get(path);
            const group = groups.get(path);
            if (token) orderedTokens.set(path, token);
            else if (group) {
                orderedGroups.set(path, group);
                visit(path);
            }
        }
    };
    visit(undefined);
    merged.tokens = orderedTokens;
    merged.groups = orderedGroups;
    merged.children = children;
}
