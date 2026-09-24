import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import type { Handle, PathIndex } from "../tokens/path-index";
import { type TokenRow, buildTokenRow } from "./token-view";

export type GroupRow = {
    handle: Handle;
    path: string;
    name: string;
    count: number;
};

export type GroupView = {
    handle: Handle;
    path: string;
    description?: string;
    groups: GroupRow[];
    tokens: TokenRow[];
};

export function firstGroupPath(index: PathIndex): string | undefined {
    for (const [handle] of index.groupEntries()) {
        const path = index.pathOf(handle);
        if (path !== undefined && !path.includes(".")) return path;
    }
    return undefined;
}

export function buildGroupView(
    index: PathIndex,
    resolved: ResolvedTokens,
    handle: Handle,
    base: string,
): GroupView | undefined {
    const path = index.pathOf(handle);
    if (path === undefined || !index.isGroup(handle)) return undefined;

    const groups: GroupRow[] = [];
    for (const child of index.childGroups(path)) {
        const childPath = index.pathOf(child);
        if (childPath === undefined) continue;
        groups.push({
            handle: child,
            path: childPath,
            name: childPath.slice(path.length + 1),
            count: index.under(childPath).length,
        });
    }

    const tokens: TokenRow[] = [];
    for (const child of index.childTokens(path)) {
        const childPath = index.pathOf(child);
        if (childPath === undefined) continue;
        const row = buildTokenRow(index, resolved, child, base, childPath.slice(path.length + 1));
        if (row) tokens.push(row);
    }

    return {
        handle,
        path,
        description: index.readDescription(resolved, handle, base),
        groups,
        tokens,
    };
}
