import {
    type InternalConfig,
    type Permutation,
    type ResolvedTokens,
    type TokenTree,
    loadInternalConfig,
    loadTokens,
    resolveTokens,
} from "@sugarcube-sh/core";
import type { TokenSources } from "@sugarcube-sh/core/client";
import type { FileOps } from "../tokens/write-ops";
import type { StudioTokenSource } from "./types";
import { nodeFileText, writeOpsToDisk } from "./write-ops-to-disk";

export type NodeTokenSourceOptions = {
    readFileText?: (path: string) => Promise<string>;
    writeFileText?: (path: string, contents: string) => Promise<void>;
    loadConfig?: () => Promise<InternalConfig | null>;
};

export type NodeTokenSource = StudioTokenSource & {
    errors: readonly string[];
};

type Loaded = {
    config: InternalConfig | null;
    trees: TokenTree[] | null;
    resolved: ResolvedTokens | null;
    defaultContext: string | null;
    sources: TokenSources | null;
    permutations: Permutation[];
    errors: readonly string[];
};

const NOTHING: Loaded = {
    config: null,
    trees: null,
    resolved: null,
    defaultContext: null,
    sources: null,
    permutations: [],
    errors: [],
};

export function createNodeTokenSource(options: NodeTokenSourceOptions = {}): NodeTokenSource {
    const io = {
        read: options.readFileText ?? nodeFileText.read,
        write: options.writeFileText ?? nodeFileText.write,
    };
    const loadConfig =
        options.loadConfig ?? (async () => (await loadInternalConfig()).config ?? null);

    let state: Loaded = NOTHING;

    const runPipeline = async (): Promise<Loaded> => {
        const config = await loadConfig();
        if (!config?.resolver) {
            return {
                ...NOTHING,
                config,
                errors: ["No resolver path in config. Studio has no tokens to show."],
            };
        }

        const loaded = await loadTokens({
            type: "resolver",
            resolverPath: config.resolver,
            config,
        });
        const result = resolveTokens(loaded.trees);

        const errors = loaded.errors.map((error) => error.message);
        for (const group of Object.values(result.errors)) {
            for (const error of group) errors.push(error.message);
        }

        return {
            config,
            trees: loaded.trees,
            resolved: result.resolved,
            sources: loaded.sources ?? null,
            permutations: loaded.permutations,
            defaultContext: loaded.defaultContext ?? null,
            errors,
        };
    };

    const load = async (): Promise<void> => {
        try {
            state = await runPipeline();
        } catch (error) {
            // Keep the last tokens that loaded, so a broken edit shows an error
            // rather than emptying the editor.
            state = { ...state, errors: [error instanceof Error ? error.message : String(error)] };
        }
    };

    let running: Promise<void> | null = null;
    let again = false;
    const reload = (): Promise<void> => {
        if (running) {
            again = true;
            return running;
        }
        running = (async () => {
            do {
                again = false;
                await load();
            } while (again);
        })().finally(() => {
            running = null;
        });
        return running;
    };

    const reloadCallbacks: Array<() => void> = [];

    return {
        ready: load(),
        get config() {
            return state.config;
        },
        get trees() {
            return state.trees;
        },
        get resolved() {
            return state.resolved;
        },
        get defaultContext() {
            return state.defaultContext;
        },
        get sources() {
            return state.sources;
        },
        get permutations() {
            return state.permutations;
        },
        get errors() {
            return state.errors;
        },

        async writeOps(files: FileOps[]) {
            await writeOpsToDisk(io, files);
        },

        async reloadTokens() {
            await reload();
            for (const fn of reloadCallbacks) fn();
        },

        onReload(fn) {
            reloadCallbacks.push(fn);
        },
    };
}
