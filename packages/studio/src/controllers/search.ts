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
    let cached: { from: StudioState; query: string; state: SearchState } | undefined;

    return {
        get state() {
            if (cached?.from !== studio.state || cached.query !== query) {
                cached = { from: studio.state, query, state: findHits(studio.state, query) };
            }
            return cached.state;
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

function findHits({ tokens, shownPermutation, getValue }: StudioState, query: string): SearchState {
    const needle = query.trim().toLowerCase();
    const hits: Hit[] = [];
    if (!needle) return { query, hits, capped: false };

    for (const path of tokens.getTokenPaths()) {
        if (!path.toLowerCase().includes(needle)) continue;
        if (hits.length === MAX_HITS) return { query, hits, capped: true };
        const token = shownPermutation.getToken(path);
        const css = token && getValue(token);
        const value = typeof css === "string" ? css : undefined;
        hits.push({ path, swatch: token?.type === "color" ? value : undefined, value });
    }
    return { query, hits, capped: false };
}
