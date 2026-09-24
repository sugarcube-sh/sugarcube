import { type StoreApi, createStore } from "zustand";
import type { ResolvedTokens, TokenSources } from "@sugarcube-sh/core/client";
import type { Handle, PathIndex } from "../tokens/path-index";
import {
    type NewNode,
    type Problem,
    type SourceDocument,
    adoptSources,
    childPath,
    create,
    openDocument,
    remove,
    rename,
    replayOps,
    setDescription,
    setValues,
} from "../tokens/source-document";
import type { TokenSnapshot } from "../tokens/types";
import type { WriteOp } from "../tokens/write-ops";

export type TokenStoreState = {
    resolved: ResolvedTokens;
    sources: TokenSources;
    index: PathIndex;
    problems: ReadonlyMap<Handle, Problem[]>;
    /** Files changed outside Studio while this copy held edits to them. */
    conflicts: readonly string[];
    /** What a save sends: the edits performed, addressed by path. */
    ops: readonly WriteOp[];

    currentContext: string;
    setCurrentContext: (context: string) => void;

    getToken: (handle: Handle, context?: string) => unknown;
    setToken: (handle: Handle, value: unknown, context?: string) => void;
    setTokens: (updates: Array<{ path: Handle; value: unknown; context?: string }>) => void;
    setDescription: (handle: Handle, description: string | undefined, context?: string) => void;
    resetToken: (handle: Handle) => void;

    renameNode: (handle: Handle, name: string) => boolean;
    /** A file belongs to whichever contexts include it, so a new node names no context. */
    createNode: (node: NewNode) => Handle | null;
    removeNode: (handle: Handle) => boolean;

    discard: () => void;
    adopt: () => void;
};

export type TokenStoreAPI = StoreApi<TokenStoreState>;

export type SourceStoreHandle = {
    store: TokenStoreAPI;
    getPathIndex: () => PathIndex;
    /** The document as disk had it, or as the last save left it. */
    getBaseline: () => SourceDocument;
    /** The scale store's write sink. A no-op: scale edits write `resolved`, which text cannot accept (D-024). */
    writeResolved: (next: ResolvedTokens) => void;
    activate: () => () => void;
};

export type SourceStoreOptions = {
    /** Operations to replay onto the baseline, from a stash that outlived a reload. */
    restore?: readonly WriteOp[];
};

function fromDoc(doc: SourceDocument) {
    return {
        resolved: doc.resolved,
        sources: doc.sources,
        index: doc.index,
        problems: doc.problems,
        ops: doc.ops,
    };
}

/** `disk` is where the host says the files changed; text arriving there is adopted. */
export function createSourceStore(
    baselineSources: TokenSources,
    disk?: StoreApi<TokenSnapshot>,
    options: SourceStoreOptions = {},
): SourceStoreHandle {
    let baseline = openDocument(baselineSources);
    let doc = options.restore ? (replayOps(baseline, options.restore) ?? baseline) : baseline;

    const store = createStore<TokenStoreState>((set, get) => {
        const commit = (next: SourceDocument | null): boolean => {
            if (!next || next === doc) return next === doc;
            doc = next;
            set(fromDoc(doc));
            return true;
        };

        const context = () => get().currentContext;

        return {
            ...fromDoc(doc),
            conflicts: [],

            currentContext: baseline.index.contexts[0] ?? "default",
            setCurrentContext: (next) => set({ currentContext: next }),

            getToken: (handle, ctx) => doc.index.readValue(doc.resolved, handle, ctx ?? context()),

            setToken: (handle, value, ctx) => {
                commit(setValues(doc, [{ handle, value, context: ctx ?? context() }]));
            },

            setTokens: (updates) => {
                commit(
                    setValues(
                        doc,
                        updates.map(({ path, value, context: ctx }) => ({
                            handle: path,
                            value,
                            context: ctx ?? context(),
                        })),
                    ),
                );
            },

            setDescription: (handle, description, ctx) => {
                commit(setDescription(doc, handle, description, ctx ?? context()));
            },

            resetToken: (handle) => {
                const was = baseline.index.readValue(baseline.resolved, handle, context());
                if (was === undefined) return;
                commit(setValues(doc, [{ handle, value: was, context: context() }]));
            },

            renameNode: (handle, name) => commit(rename(doc, handle, name)),
            createNode: (node) => {
                const path = childPath(doc, node.parent, node.name);
                if (path === undefined || !commit(create(doc, node))) return null;
                return doc.index.handleAt(path) ?? null;
            },
            removeNode: (handle) => commit(remove(doc, handle)),

            adopt: () => {
                doc = { ...doc, ops: [] };
                baseline = doc;
                set({ ops: doc.ops });
            },

            discard: () => {
                doc = baseline;
                set({ ...fromDoc(doc), conflicts: [] });
            },
        };
    });

    /**
     * Adopt silently where nothing is pending, keep the edit and say so where
     * something is. The page only needs telling when we kept our own text —
     * otherwise the host is already showing what just arrived.
     */
    const arrived = (next: TokenSources) => {
        if (next === baseline.sources) return;

        const adopted = adoptSources(doc, baseline, next);
        baseline = adopted.baseline;
        doc = adopted.doc;

        store.setState({ ...fromDoc(doc), conflicts: adopted.conflicts });
    };

    return {
        store,
        getPathIndex: () => doc.index,
        getBaseline: () => baseline,
        writeResolved: () => {},
        activate: () => {
            if (!disk) return () => {};
            return disk.subscribe((snapshot) => {
                if (snapshot.sources) arrived(snapshot.sources);
            });
        },
    };
}
