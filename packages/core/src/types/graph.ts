import type { TokenType } from "./tokens.js";

/** A permutation/context label, e.g. `"default"` or `"dark"`. */
export type GraphContext = string;

/** Whether a token holds a literal value or aliases another token. */
export type NodeKind = "primitive" | "alias";

export interface TokenNode {
    /** The token's `$path` (stable identity across every context). */
    id: string;
    /** Last path segment, e.g. `normal` in `color.fill.normal`. */
    name: string;
    /** Path prefix, e.g. `color.fill`. Empty for a top-level token. */
    group: string;
    /** The token's `$type`. */
    type: TokenType;
    /** Generated CSS variable name (without the leading `--`), from `$names.css`. */
    cssName: string;
    /**
     * Per-context facts. A token's authored value — and whether it's an alias or
     * a literal — can differ between contexts (e.g. a mode that re-points an
     * alias), so these are keyed by context rather than stored once.
     */
    perContext: Record<GraphContext, { raw: unknown; kind: NodeKind }>;
}

export interface TokenEdge {
    /** `$path` of the referencing token. */
    from: string;
    /** `$path` of the referenced token. */
    to: string;
    /** Contexts in which this alias edge exists. */
    contexts: GraphContext[];
}

export interface GraphContextInfo {
    /** The context key, e.g. `"perm:1"` — matches `perContext` keys and `edge.contexts`. */
    id: GraphContext;
    /** Human-readable label, e.g. `"dark"`. Falls back to `id` when no permutation info is available. */
    label: string;
    /** CSS selector for this context, e.g. `[data-mode="dark"]`, when known. */
    selector?: string;
    /** The modifier→context input, e.g. `{ mode: "dark" }`, when known. */
    input?: Record<string, string>;
}

export interface TokenGraph {
    /**
     * Every context, in input order, with human labels. `contexts[i].id` is the
     * key used by `perContext` and `edge.contexts`.
     */
    contexts: GraphContextInfo[];
    /** Nodes keyed by `$path`. */
    nodes: Map<string, TokenNode>;
    /** Alias edges (token → referenced token), each tagged with where it exists. */
    edges: TokenEdge[];
    /**
     * The context where every modifier sits at the context the resolver declares as its
     * default (resolver spec §4.1.5.3) — the `:root` output every page gets.
     *
     * Absent when it can't be known: no declared defaults to compare an explicit input
     * against, or more than one context qualifying, in which case there is no single answer
     * to give rather than an arbitrary one.
     */
    defaultContext?: GraphContext;
}
