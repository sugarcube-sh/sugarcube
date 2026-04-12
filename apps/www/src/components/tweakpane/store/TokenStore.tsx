import {
    type InternalConfig,
    type ResolvedTokens,
    type TokenTree,
    generateCSSVariables,
    processAndConvertTokens,
} from "@sugarcube-sh/core/client";
import { useEffect, useRef } from "react";
import { create } from "zustand";
import snapshotData from "../../../../.sugarcube/tokens-snapshot.json";
import { currentPaletteFromReference } from "./palette-discovery";

/**
 * The in-memory token store that powers the tweakpane.
 *
 * Holds the project's resolved tokens in mutable state, exposes
 * `setToken(path, value)` for sections to call, re-runs the sugarcube
 * pipeline on every change, and injects the resulting CSS into the
 * document so the live page reflects edits in real time.
 *
 * Built on zustand because:
 *  - Selector-based subscriptions: components only re-render when the
 *    specific slice they read changes, not on every store update.
 *  - Accessible from outside React (via `useTokenStore.getState()`),
 *    which we need for URL-state encoding/decoding and event handlers.
 *  - No provider boilerplate; the store is a singleton initialized
 *    from the build-time snapshot at module load.
 */

const snapshot = snapshotData as unknown as {
    formatVersion: number;
    generatedAt: string;
    sourceConfigPath: string;
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
};

/**
 * The DTCG-author-facing slim shape of a token — just the fields a
 * designer would actually write into a token JSON file. Used by the
 * diff panel to render code-like before/after blocks without showing
 * the pipeline-internal fields (`$source`, `$resolvedValue`, etc.).
 */
export type SlimToken = {
    $value: unknown;
    $extensions?: Record<string, unknown>;
};

/** A change between the original snapshot and the current state. */
export type TokenDiffEntry = {
    /** Token path WITHOUT the permutation prefix (e.g. `panel.radius`) */
    path: string;
    /** The source file this token was defined in (e.g. `tokens/color/neutral.json`). */
    sourcePath: string;
    /**
     * The set of permutation contexts this change applies to. Empty if
     * the change is identical across every permutation that owns this
     * path (the common case — most edits are mode-independent and we
     * don't want a context badge cluttering the diff). Populated when
     * the change diverges across permutations, in which case there will
     * be one diff entry per distinct (from, to) pair labeled with the
     * contexts that share that change.
     */
    contexts: string[];
    /** The slim DTCG token shape from the snapshot. */
    from: SlimToken;
    /** The slim DTCG token shape after edits. */
    to: SlimToken;
};

type TokenStoreState = {
    /** Current resolved tokens (mutated by setToken). */
    resolved: ResolvedTokens;
    /** Generated CSS from the most recent successful pipeline run. */
    css: string | null;
    /** True while the pipeline is computing. */
    isComputing: boolean;
    /** Error from the most recent pipeline run, if any. */
    error: string | null;
    /** Pipeline run time of the last successful computation, in ms. */
    lastRunMs: number | null;

    /**
     * Read the current value of a token. Path is without permutation prefix.
     * If `context` is provided, reads from that specific permutation only.
     */
    getToken: (path: string, context?: string) => unknown;
    /**
     * Set a token's value. Pass the path without the permutation prefix
     * (e.g. `panel.radius`, not `perm:0.panel.radius`).
     *
     * If `context` is omitted, the value is written to ALL permutations
     * simultaneously — the right default for tokens that don't differ by
     * mode (radius, spacing, font family, etc.).
     *
     * If `context` is provided, writes only to that permutation. Use this
     * for genuinely mode-dependent values.
     */
    setToken: (path: string, value: unknown, context?: string) => void;
    /**
     * Atomically set multiple tokens in a single state update. Use this
     * when one user action needs to change several tokens together (e.g.
     * BordersSection's width slider touches both `form-control.border-width`
     * and `panel.border-width`). One state update means one pipeline run
     * instead of N.
     */
    setTokens: (updates: Array<{ path: string; value: unknown; context?: string }>) => void;
    /** Reset a single token to its snapshot default. */
    resetToken: (path: string) => void;
    /** Reset everything to the snapshot defaults. */
    resetAll: () => void;
};

/**
 * One entry in the path index — a single (context, key) pair that lives
 * under a given canonical `$path`. The `context` value comes from each
 * token's `$source.context` field, which is the canonical identifier the
 * pipeline assigns to each permutation. Today it looks like `"perm:0"`
 * for apps/www; in other projects (or future versions of sugarcube) it
 * could look like `"light"` / `"dark"` or anything else.
 */
type PathIndexEntry = {
    /** The token's `$source.context` — canonical permutation identifier */
    context: string;
    /** The lookup key in `ResolvedTokens` for this (path, context) pair */
    key: string;
};

/**
 * Index from a token's canonical `$path` (without any permutation prefix)
 * to all the (context, key) pairs in the resolved object that share that
 * `$path` — one entry per permutation. Built once from the snapshot at
 * module load.
 *
 * Built from the canonical token data rather than reconstructed by string
 * manipulation because the lookup-key format (`perm:0.color.primary`) is
 * an internal implementation detail of the pipeline. Each token carries
 * its own `$path` and `$source.context`, so we use the data the pipeline
 * gives us instead of guessing the prefix format.
 *
 * Storing the per-context mapping (rather than just an array of keys)
 * means the eventual per-permutation editing feature is just a filter
 * over `pathIndex.get(path)` — no schema change required.
 */
const pathIndex: Map<string, PathIndexEntry[]> = (() => {
    const index = new Map<string, PathIndexEntry[]>();
    for (const [key, token] of Object.entries(snapshot.resolved)) {
        if (
            token &&
            typeof token === "object" &&
            "$path" in token &&
            "$value" in token &&
            "$source" in token
        ) {
            const $path = (token as { $path: string }).$path;
            const $source = (token as { $source: { context?: string } }).$source;
            const context = $source?.context ?? "default";

            const existing = index.get($path);
            const entry: PathIndexEntry = { context, key };
            if (existing) {
                existing.push(entry);
            } else {
                index.set($path, [entry]);
            }
        }
    }
    return index;
})();

/**
 * Read a token's `$value` by its canonical `$path`. Reads from the first
 * matching entry; values are kept in sync across permutations by setToken,
 * so any entry will do for reads.
 *
 * If a specific `context` is provided, reads from that permutation only.
 * Otherwise reads from the first matching entry (typically the default
 * permutation).
 */
function readTokenValue(resolved: ResolvedTokens, barePath: string, context?: string): unknown {
    const entries = pathIndex.get(barePath);
    if (!entries || entries.length === 0) return undefined;

    const entry = context ? entries.find((e) => e.context === context) : entries[0];
    if (!entry) return undefined;

    const token = resolved[entry.key];
    if (!token || !("$value" in token)) return undefined;
    return token.$value;
}

/**
 * Immutably update a token's `$value` (and `$resolvedValue`).
 *
 * If `context` is omitted (the default), updates the token at EVERY
 * permutation that shares this `$path` — i.e. the edit affects all modes
 * simultaneously. This is the right default for most edits because most
 * tokens (radius, spacing, type ratio, font family) aren't mode-dependent.
 *
 * If `context` is provided, updates only the entry for that specific
 * permutation. This is the API the future per-permutation editing UI
 * will use; the data is already there in the path index.
 */
function setTokenValueByPath(
    resolved: ResolvedTokens,
    barePath: string,
    newValue: unknown,
    context?: string
): ResolvedTokens {
    const entries = pathIndex.get(barePath);
    if (!entries || entries.length === 0) return resolved;

    const targetEntries = context ? entries.filter((e) => e.context === context) : entries;

    const updates: ResolvedTokens = {};
    for (const { key } of targetEntries) {
        const existing = resolved[key];
        if (!existing || !("$value" in existing)) continue;
        // Cast: we've checked `existing` has `$value`, so it's a token
        // (not NodeMetadata). The constructed object preserves all
        // existing fields and only updates `$value`.
        //
        // We deliberately do NOT touch `$resolvedValue` here. The
        // contract for `$resolvedValue` is "the fully-resolved final
        // value" — for a colour, an oklch object; for a dimension, a
        // value+unit object. The new `$value` is typically a reference
        // string like "{color.orange.600}", which is NOT a resolved
        // value. Copying it into `$resolvedValue` corrupts the field.
        //
        // The honest behaviour is to leave `$resolvedValue` stale. The
        // in-browser pipeline doesn't read it (CSS generation walks
        // `$value`), so nothing breaks today. Any future code that
        // needs a fresh resolved value must call a (not-yet-existing)
        // re-resolver — see notes/text-link-cascade-investigation.md.
        updates[key] = {
            ...existing,
            $value: newValue,
        } as ResolvedTokens[string];
    }
    return { ...resolved, ...updates };
}

/**
 * The set of all permutation contexts present in the snapshot, in the
 * order they first appear. Useful for UIs that need to enumerate the
 * available modes (e.g., a per-perm editor or a mode toggle).
 */
export const availableContexts: string[] = (() => {
    const seen = new Set<string>();
    for (const entries of pathIndex.values()) {
        for (const { context } of entries) {
            seen.add(context);
        }
    }
    return Array.from(seen);
})();

/**
 * Mapping from permutation input shape (serialized as JSON) to its
 * canonical context string. Built by walking the config's permutations
 * array in parallel with the order in which contexts first appear in the
 * snapshot's resolved tokens. Both should be in the same order because
 * the pipeline processes permutations in config order.
 *
 * This deliberately does NOT assume any particular format for context
 * strings (no `perm:N` parsing). The mapping is built from canonical
 * data — each permutation's `input` shape is matched to whichever
 * context the pipeline assigned at the same index.
 */
const inputToContextMap: Map<string, string> = (() => {
    const map = new Map<string, string>();
    const perms = snapshot.config.variables.permutations ?? [];

    perms.forEach((perm, index) => {
        const context = availableContexts[index];
        if (!context) return;
        const inputKey = JSON.stringify(perm.input ?? {});
        map.set(inputKey, context);
    });

    return map;
})();

/**
 * Look up the canonical context name for a permutation by its input
 * shape. Sections that need per-permutation editing call this to bridge
 * from user-facing names ("light"/"dark" mode) to whatever context the
 * pipeline assigned.
 *
 * @example
 *   const lightContext = contextForPermutationInput({ mode: "light" });
 *   setToken("color.neutral.fill.normal", "{color.blue.100}", lightContext);
 */
export function contextForPermutationInput(input: Record<string, unknown>): string | undefined {
    return inputToContextMap.get(JSON.stringify(input));
}

/**
 * Derive the currently-selected palette for a token family by scanning
 * family token references for a segment matching the `palettes` list.
 *
 * @param family   - Token path prefix, e.g. `"color.neutral"`.
 * @param palettes - Explicit palette list (from config).
 */
export function useFamilyPalette(family: string, palettes: readonly string[]): string | undefined {
    return useTokenStore((state) => {
        const reader = (path: string, ctx?: string) => readTokenValue(state.resolved, path, ctx);
        return currentPaletteFromReference(reader, family, palettes);
    });
}

/**
 * Look up the lookup keys (one per permutation) for a given canonical
 * `$path`. Returns an empty array if the path doesn't exist in the
 * snapshot. Used by cascade helpers (palette swap, scale edit, etc.)
 * that need to write to a specific token across all permutations.
 *
 * Internal callers prefer this over poking at the path index directly
 * so the index's exact shape stays an implementation detail.
 */
export function getKeysForPath(barePath: string): string[] {
    const entries = pathIndex.get(barePath);
    if (!entries) return [];
    return entries.map((e) => e.key);
}

/**
 * Find all token `$path`s that match a simple glob pattern. The pattern
 * supports `*` to match exactly one path segment.
 *
 * Returns paths in the order they appear in the snapshot, which reflects
 * the load order of the source token files. For most well-organized
 * projects this is also the semantic order (e.g., `text.xs` before
 * `text.sm` before `text.base`).
 *
 * This is the primitive that lets sections discover their candidate
 * tokens from the project's actual data instead of hardcoding values.
 *
 * @example
 *   tokenPathsMatching("text.*")
 *   // → ["text.xs", "text.sm", "text.base", "text.lg", "text.xl",
 *   //    "text.2xl", "text.3xl", "text.4xl", ...]
 *
 * @example
 *   tokenPathsMatching("color.*.fill.normal")
 *   // → ["color.neutral.fill.normal", "color.accent.fill.normal", ...]
 */
export function tokenPathsMatching(pattern: string): string[] {
    const patternSegs = pattern.split(".");
    const matches: string[] = [];
    // Iterate the path index in insertion order so the result reflects
    // the snapshot's natural ordering.
    for (const path of pathIndex.keys()) {
        const pathSegs = path.split(".");
        if (pathSegs.length !== patternSegs.length) continue;
        let ok = true;
        for (let i = 0; i < patternSegs.length; i++) {
            if (patternSegs[i] === "*") continue;
            if (patternSegs[i] !== pathSegs[i]) {
                ok = false;
                break;
            }
        }
        if (ok) matches.push(path);
    }
    return matches;
}

/**
 * Read a token's `$type` field by its bare path. Returns `undefined`
 * if the path doesn't exist or the token doesn't carry a `$type`.
 *
 * The DTCG `$type` is static metadata — it doesn't change with edits,
 * so reading from the original snapshot is fine.
 */
export function getTokenType(path: string): string | undefined {
    const entries = pathIndex.get(path);
    const entry = entries?.[0];
    if (!entry) return undefined;
    const token = snapshot.resolved[entry.key];
    if (!token || typeof token !== "object") return undefined;
    return (token as { $type?: string }).$type;
}

/**
 * Placeholder type for the sugarcube scale extension. When the scale
 * extension is implemented in core (see `notes/studio-panel-config-spec.md`),
 * this will be replaced by the real `ScaleExtension` type imported from
 * `@sugarcube-sh/core/client`.
 *
 * For now, it's a loose record — enough to let the dispatch branch in
 * `ScaleControl.tsx` compile and check for `mode` at runtime without
 * committing to a specific shape.
 */
export type ScaleExtension = {
    mode: "exponential" | "multipliers";
    [key: string]: unknown;
};

/**
 * Walk `snapshot.trees` looking for a group node at `path` and return
 * its `$extensions.sh.sugarcube.scale` field if present.
 *
 * The scale extension (when implemented) lives on a non-leaf node in
 * the DTCG tree — e.g. `size.step` — and describes how to generate
 * child tokens from a recipe. Its children (`size.step.0`, `size.step.1`,
 * etc.) are virtual: they exist only after build-time expansion, and
 * they don't carry the original scale extension themselves. So to find
 * the recipe for a given scale, we have to walk the raw tree, not the
 * flat `resolved` map.
 *
 * Returns `undefined` if no such extension exists at `path`, or if
 * `path` doesn't resolve to a tree node at all. Today this always
 * returns `undefined` — the scale extension hasn't been implemented
 * yet — but the dispatch site in `ScaleControl` uses it so that Model B
 * lands as a purely additive change when the extension arrives.
 */
export function getScaleExtension(path: string): ScaleExtension | undefined {
    const segments = path.split(".");
    for (const tree of snapshot.trees) {
        const node = findNodeInTree(tree, segments);
        const scale = extractScaleExtension(node);
        if (scale) return scale;
    }
    return undefined;
}

/**
 * Walk a single tree, following the given path segments. Returns the
 * node found at that path, or `undefined` if any segment is missing.
 */
function findNodeInTree(tree: unknown, segments: string[]): unknown {
    let node: unknown = tree;
    for (const segment of segments) {
        if (!node || typeof node !== "object") return undefined;
        node = (node as Record<string, unknown>)[segment];
    }
    return node;
}

/**
 * Pull the sugarcube scale extension off a tree node, validating it
 * just enough to know we have *something* with a `mode`. Returns
 * `undefined` otherwise.
 */
function extractScaleExtension(node: unknown): ScaleExtension | undefined {
    if (!node || typeof node !== "object") return undefined;
    const extensions = (node as { $extensions?: Record<string, unknown> }).$extensions;
    const sugarcube = extensions?.["sh.sugarcube"] as { scale?: unknown } | undefined;
    const scale = sugarcube?.scale;
    if (
        scale &&
        typeof scale === "object" &&
        "mode" in scale &&
        (scale.mode === "exponential" || scale.mode === "multipliers")
    ) {
        return scale as ScaleExtension;
    }
    return undefined;
}

/**
 * Find all token `$path`s that start with the given prefix, followed by
 * a dot separator. Unlike `tokenPathsMatching` (which requires a fixed
 * segment count), this returns paths at any depth below the prefix.
 *
 * Returns leaf token paths only — group nodes (those without a `$value`)
 * are already excluded from the path index.
 *
 * @example
 *   tokenPathsUnder("color.neutral")
 *   // → ["color.neutral.fill.quiet", "color.neutral.fill.normal", ...]
 */
export function tokenPathsUnder(prefix: string): string[] {
    const needle = `${prefix}.`;
    const matches: string[] = [];
    for (const path of pathIndex.keys()) {
        if (path.startsWith(needle)) matches.push(path);
    }
    return matches;
}

/**
 * The zustand store. Initialized from the snapshot at module load.
 *
 * Components consume it via `useTokenStore(selector)` for fine-grained
 * subscriptions. Non-React code can use `useTokenStore.getState()` and
 * `useTokenStore.setState(...)` directly.
 */
export const useTokenStore = create<TokenStoreState>((set, get) => ({
    resolved: snapshot.resolved,
    css: null,
    isComputing: false,
    error: null,
    lastRunMs: null,

    getToken: (path, context) => readTokenValue(get().resolved, path, context),

    setToken: (path, value, context) => {
        set((state) => ({
            resolved: setTokenValueByPath(state.resolved, path, value, context),
        }));
    },

    setTokens: (updates) => {
        set((state) => {
            let next = state.resolved;
            for (const { path, value, context } of updates) {
                next = setTokenValueByPath(next, path, value, context);
            }
            return { resolved: next };
        });
    },

    resetToken: (path) => {
        const original = readTokenValue(snapshot.resolved, path);
        if (original === undefined) return;
        set((state) => ({
            resolved: setTokenValueByPath(state.resolved, path, original),
        }));
    },

    resetAll: () => {
        set({ resolved: snapshot.resolved });
    },
}));

/**
 * Reduce a resolved token to the DTCG-author shape (`$value` and, if
 * present, `$extensions`). Pipeline-internal fields like `$source`,
 * `$resolvedValue`, and `$originalPath` are dropped — they're noise from
 * the perspective of "what would a designer write in their token file".
 *
 * Returns `null` if the input isn't a token (e.g. a group node).
 */
function slimToken(token: ResolvedTokens[string] | undefined): SlimToken | null {
    if (!token || typeof token !== "object" || !("$value" in token)) return null;
    const $value = (token as { $value: unknown }).$value;
    const $extensions = (token as { $extensions?: Record<string, unknown> }).$extensions;
    if ($extensions && Object.keys($extensions).length > 0) {
        return { $value, $extensions };
    }
    return { $value };
}

/**
 * Compute the diff between a resolved-tokens object and the snapshot
 * defaults.
 *
 * Walks every (path, context) entry rather than reading just the first
 * entry per `$path`, so per-permutation edits are caught. After
 * collecting per-context changes, the result is grouped by path:
 *
 *   - If every entry that shares a `$path` has an identical (from, to),
 *     they collapse into ONE diff row with `contexts: []` (the common
 *     case for mode-independent edits — palette swap, scale change).
 *
 *   - If entries diverge (different from or to across permutations),
 *     they emit one row per distinct (from, to) pair, each labeled with
 *     the contexts that share that change.
 *
 * The from/to are slim DTCG-author tokens (`$value` + optional
 * `$extensions`) so the diff renderer can pretty-print them as the kind
 * of JSON a designer would actually write in a source token file.
 *
 * NOT a zustand selector — it returns a fresh array on every call, so
 * subscribing to it directly would trip zustand's reference check and
 * loop forever. Components should subscribe to `state.resolved` and
 * call this from a `useMemo`.
 */
export function computeDiff(resolved: ResolvedTokens): TokenDiffEntry[] {
    type RawChange = {
        context: string;
        sourcePath: string;
        from: SlimToken;
        to: SlimToken;
        fromKey: string;
        toKey: string;
    };

    // Pass 1: collect per-(path, context) changes.
    const byPath = new Map<string, RawChange[]>();
    for (const [path, indexEntries] of pathIndex.entries()) {
        for (const { context, key } of indexEntries) {
            const current = resolved[key];
            const currentSlim = slimToken(current);
            const originalSlim = slimToken(snapshot.resolved[key]);
            if (!currentSlim || !originalSlim) continue;

            // JSON.stringify with stable key order via slimToken's
            // construction order ($value before $extensions).
            const fromKey = JSON.stringify(originalSlim);
            const toKey = JSON.stringify(currentSlim);
            if (fromKey === toKey) continue;

            const sourcePath =
                current && "$source" in current
                    ? (current as { $source: { sourcePath: string } }).$source.sourcePath
                    : "";

            const list = byPath.get(path);
            const change: RawChange = {
                context,
                sourcePath,
                from: originalSlim,
                to: currentSlim,
                fromKey,
                toKey,
            };
            if (list) {
                list.push(change);
            } else {
                byPath.set(path, [change]);
            }
        }
    }

    // Pass 2: for each path, group changes by their (fromKey, toKey)
    // signature so identical-everywhere changes collapse into one row
    // and diverging changes emit one row each.
    const entries: TokenDiffEntry[] = [];
    for (const [path, changes] of byPath.entries()) {
        const grouped = new Map<string, RawChange[]>();
        for (const change of changes) {
            const sig = `${change.fromKey}\u0000${change.toKey}`;
            const list = grouped.get(sig);
            if (list) {
                list.push(change);
            } else {
                grouped.set(sig, [change]);
            }
        }

        // If there's exactly one signature AND it covers every
        // permutation that owns this path, no context labels needed.
        const totalIndex = pathIndex.get(path)?.length ?? 0;
        const collapseAll = grouped.size === 1;

        for (const group of grouped.values()) {
            const first = group[0];
            if (!first) continue;
            const showContexts = !(collapseAll && group.length === totalIndex);
            entries.push({
                path,
                sourcePath: first.sourcePath,
                contexts: showContexts ? group.map((c) => c.context) : [],
                from: first.from,
                to: first.to,
            });
        }
    }

    return entries;
}

/**
 * Read and write a single token by its bare path. Returns a tuple
 * `[currentValue, setValue]` similar to `useState`. Subscribes only to
 * this specific path's value, so changes elsewhere don't re-render.
 *
 * @example
 *   const [radius, setRadius] = useToken("panel.radius");
 *   setRadius("{radius.sm}");
 */
export function useToken<T = unknown>(path: string): [T | undefined, (value: T) => void] {
    // Subscribe to just this token's value via a selector. Components
    // re-render only when this specific path changes.
    const value = useTokenStore((state) => readTokenValue(state.resolved, path)) as T | undefined;
    const setToken = useTokenStore((state) => state.setToken);
    return [value, (next: T) => setToken(path, next)];
}

/**
 * Mounts the pipeline runner that re-runs sugarcube whenever the resolved
 * tokens change, and injects the resulting CSS into the document.
 *
 * Render this component once near the top of the tree (inside the
 * tweakpane). It has no visual output beyond the injected `<style>` tag.
 *
 * The pipeline runner lives in a component (rather than at module load)
 * so it has access to React effects for race-condition handling.
 */
export function TokenStorePipelineRunner() {
    const resolved = useTokenStore((state) => state.resolved);
    const css = useTokenStore((state) => state.css);

    // Track in-flight pipeline runs so a faster later run can't be
    // overwritten by a slower earlier one.
    const runIdRef = useRef(0);

    useEffect(() => {
        const runId = ++runIdRef.current;
        let cancelled = false;
        useTokenStore.setState({ isComputing: true });

        async function run() {
            try {
                const startedAt = performance.now();

                const converted = await processAndConvertTokens(
                    snapshot.trees,
                    resolved,
                    snapshot.config
                );
                const result = await generateCSSVariables(converted, snapshot.config);

                if (cancelled || runId !== runIdRef.current) return;

                const allCss = result.map((file) => file.css).join("\n\n");
                useTokenStore.setState({
                    css: allCss,
                    lastRunMs: performance.now() - startedAt,
                    error: null,
                    isComputing: false,
                });
            } catch (err) {
                if (cancelled || runId !== runIdRef.current) return;
                useTokenStore.setState({
                    error:
                        err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err),
                    css: null,
                    isComputing: false,
                });
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [resolved]);

    /*
     * Inject the generated CSS into the React tree. Because this <style>
     * tag is rendered after the build-time CSS file in source order
     * (it lives in the body, the build-time file in <head>), its rules
     * win on equal-specificity matches like `:root { --foo: bar; }`.
     */
    return css === null ? null : <style data-token-store>{css}</style>;
}
