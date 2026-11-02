import type { Studio, StudioState } from "./studio";

export const MAX_HITS = 40;

export interface Hit {
    readonly path: string;
    readonly swatch: string | undefined;
    readonly value: string | undefined;
}

export interface SearchState {
    readonly query: string;
    readonly hits: readonly Hit[];
    readonly capped: boolean;
}

export interface Search {
    readonly state: SearchState;
    subscribe(listener: () => void): () => void;
    destroy(): void;
    setQuery(query: string): void;
}

export function createSearch(studio: Studio): Search {
    const listeners = new Map<() => void, () => void>();
    let query = "";
    let kept: { from: StudioState; query: string; state: SearchState } | undefined;

    return {
        get state() {
            if (kept?.from !== studio.state || kept.query !== query) {
                kept = { from: studio.state, query, state: found(studio.state, query) };
            }
            return kept.state;
        },
        subscribe(listener) {
            const stop = studio.subscribe(listener);
            listeners.set(listener, stop);
            return () => {
                stop();
                listeners.delete(listener);
            };
        },
        destroy() {
            for (const stop of listeners.values()) stop();
            listeners.clear();
        },
        setQuery(next) {
            query = next;
            for (const listener of listeners.keys()) listener();
        },
    };
}

function found({ tokens, showing, value: asWritten }: StudioState, query: string): SearchState {
    const needle = query.trim().toLowerCase();
    const hits: Hit[] = [];
    if (!needle) return { query, hits, capped: false };

    for (const path of tokens.getTokenPaths()) {
        if (!path.toLowerCase().includes(needle)) continue;
        if (hits.length === MAX_HITS) return { query, hits, capped: true };
        const token = showing.getToken(path);
        const css = token && asWritten(token);
        const value = typeof css === "string" ? css : undefined;
        hits.push({ path, swatch: token?.type === "color" ? value : undefined, value });
    }
    return { query, hits, capped: false };
}
