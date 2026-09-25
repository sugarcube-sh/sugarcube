import { useCallback, useMemo } from "react";
import { useBaseline, usePathIndex, useTokenStore } from "../store/hooks";
import type { Handle } from "../tokens/path-index";
import { type GroupView, buildGroupView } from "./group-view";
import { type Placement, placementFor, siblingType } from "./placement";
import { type Problem, writableFiles } from "../tokens/source-document";
import { type TokenRow, baseContext, buildTokenRow } from "./token-view";
import { emptyValueFor } from "./value-field";

export function useBaseContext(): string {
    return baseContext(usePathIndex(), useBaseline().defaultContext);
}

export function useGroupView(handle: Handle | undefined): GroupView | undefined {
    const index = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const base = useBaseContext();

    return useMemo(
        () => (handle === undefined ? undefined : buildGroupView(index, resolved, handle, base)),
        [index, resolved, handle, base],
    );
}

export function useTokenRow(handle: Handle | undefined): TokenRow | undefined {
    const index = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const base = useBaseContext();

    return useMemo(
        () => (handle === undefined ? undefined : buildTokenRow(index, resolved, handle, base)),
        [index, resolved, handle, base],
    );
}

export function usePreviewValue(handle: Handle, context: string): unknown {
    const index = usePathIndex();
    return useTokenStore((state) => index.readValue(state.resolved, handle, context));
}

/**
 * D-040: an edit targets the document, not the context on screen. Every context
 * drawing this token from the base file gets the new value; the ones declaring
 * their own override keep it.
 */
export function useWriteBase(): (row: TokenRow, value: unknown) => void {
    const index = usePathIndex();
    const setTokens = useTokenStore((state) => state.setTokens);

    return useCallback(
        (row, value) => {
            const overridden = new Set(row.overrides.map((override) => override.context));
            const updates = index
                .entriesFor(row.handle)
                .filter((entry) => !overridden.has(entry.context))
                .map((entry) => ({ path: row.handle, value, context: entry.context }));

            if (updates.length > 0) setTokens(updates);
        },
        [index, setTokens],
    );
}

export function useWriteOverride(): (row: TokenRow, context: string, value: unknown) => void {
    const setToken = useTokenStore((state) => state.setToken);

    return useCallback((row, context, value) => setToken(row.handle, value, context), [setToken]);
}

function useWritableFiles(): ReadonlySet<string> {
    const sources = useTokenStore((state) => state.sources);
    return useMemo(() => new Set(writableFiles(sources)), [sources]);
}

export function useRowWritable(row: TokenRow): boolean {
    const writable = useWritableFiles();
    return row.sourcePath !== undefined && writable.has(row.sourcePath);
}

export function usePlacement(parent?: Handle): Placement {
    const index = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const base = useBaseContext();
    const writable = useWritableFiles();

    return useMemo(
        () => placementFor(index, resolved, base, parent, writable),
        [index, resolved, base, parent, writable],
    );
}

export function useSiblingType(parent?: Handle): string | undefined {
    const index = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const base = useBaseContext();

    return useMemo(
        () => siblingType(index, resolved, base, parent),
        [index, resolved, base, parent],
    );
}

export type NewToken = {
    parent?: Handle;
    name: string;
    type: string;
    sourcePath: string;
};

export function useCreateToken(): (token: NewToken) => Handle | null {
    const createNode = useTokenStore((state) => state.createNode);

    return useCallback(
        ({ parent, name, type, sourcePath }) =>
            createNode({
                ...(parent === undefined ? {} : { parent }),
                name,
                sourcePath,
                token: { $type: type, $value: emptyValueFor(type) },
            }),
        [createNode],
    );
}

export type NewGroup = {
    parent?: Handle;
    name: string;
    sourcePath: string;
};

export function useCreateGroup(): (group: NewGroup) => Handle | null {
    const createNode = useTokenStore((state) => state.createNode);

    return useCallback(
        ({ parent, name, sourcePath }) =>
            createNode({ ...(parent === undefined ? {} : { parent }), name, sourcePath }),
        [createNode],
    );
}

export function useProblems(handle: Handle): readonly Problem[] {
    const problems = useTokenStore((state) => state.problems);
    return problems?.get(handle) ?? EMPTY_PROBLEMS;
}

const EMPTY_PROBLEMS: readonly Problem[] = [];

export function useRemoveNode(): (handle: Handle) => boolean {
    return useTokenStore((state) => state.removeNode);
}

export function useRenameNode(): (handle: Handle, name: string) => boolean {
    return useTokenStore((state) => state.renameNode);
}
