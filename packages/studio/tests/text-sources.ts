import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { ResolvedTokens, TokenSources } from "@sugarcube-sh/core/client";
import { createStore } from "zustand/vanilla";
import { createDiffStore } from "../src/store/create-diff-store";
import { type TokenStoreState, createSourceStore } from "../src/store/create-source-store";
import { createScaleState } from "../src/store/scale-state";
import { PathIndex } from "../src/tokens/path-index";
import { openDocument } from "../src/tokens/source-document";
import type { TokenSnapshot } from "../src/tokens/types";

const TOKENS = join(__dirname, "../demo");
const RESOLVER = join(TOKENS, "tokens.resolver.json");

export function sources(): TokenSources {
    const doc = JSON.parse(readFileSync(RESOLVER, "utf8"));
    const refs = (list: Array<{ $ref: string }>) =>
        list.map((s) => relative(process.cwd(), join(TOKENS, s.$ref)));

    const base = refs(doc.resolutionOrder.find((s: { type: string }) => s.type === "set").sources);
    const modifier = doc.resolutionOrder.find((s: { type: string }) => s.type === "modifier");
    const order = Object.keys(modifier.contexts).map((name, index) => ({
        context: `perm:${index}`,
        sources: [...base, ...refs(modifier.contexts[name])].map((file) => ({ file })),
    }));

    const files: Record<string, string> = {};
    for (const file of readdirSync(TOKENS)) {
        if (file.endsWith(".json") && file !== "tokens.resolver.json") {
            files[relative(process.cwd(), join(TOKENS, file))] = readFileSync(
                join(TOKENS, file),
                "utf8",
            );
        }
    }

    return { files, order };
}

export function fileNamed(s: TokenSources, name: string): string {
    const path = Object.keys(s.files).find((p) => p.endsWith(name));
    if (!path) throw new Error(`no fixture file named ${name}`);
    return path;
}

export type { TokenSources };

export function inMemory(
    files: Record<string, string>,
    contexts: Record<string, string[]> = { default: Object.keys(files) },
): TokenSources {
    return {
        files,
        order: Object.entries(contexts).map(([context, list]) => ({
            context,
            sources: list.map((file) => ({ file })),
        })),
    };
}

export function changedFiles(baseline: TokenSources, working: TokenSources) {
    return Object.entries(working.files)
        .filter(([path, text]) => baseline.files[path] !== text)
        .map(([path, text]) => ({ path, text }));
}

export function wired(base: TokenSources = sources()) {
    const doc = openDocument(base);
    const baseline = createStore<TokenSnapshot>(() => ({
        config: {} as TokenSnapshot["config"],
        trees: doc.trees,
        resolved: doc.resolved,
        defaultContext: null,
        permutations: [],
        sources: base,
    }));
    const tokens = createSourceStore(base, baseline);
    const scale = createScaleState(
        [],
        baseline.getState(),
        tokens.getPathIndex,
        tokens.store,
        baseline,
        tokens.writeResolved,
    );
    const diff = createDiffStore(tokens, scale.store);
    const teardowns = [tokens.activate(), scale.activate(), diff.activate()];

    return {
        base,
        baseline,
        tokens,
        scale,
        diff,
        stop: () => {
            for (const teardown of teardowns) teardown();
        },
    };
}

export function stubTokenStore(resolved: ResolvedTokens) {
    return createStore<TokenStoreState>(() => ({
        resolved,
        sources: { files: {}, order: [] },
        index: new PathIndex(resolved),
        problems: new Map(),
        conflicts: [],
        ops: [],
        currentContext: "default",
        setCurrentContext: () => {},
        getToken: () => undefined,
        setToken: () => {},
        setTokens: () => {},
        setDescription: () => {},
        resetToken: () => {},
        renameNode: () => false,
        createNode: () => null,
        removeNode: () => false,
        discard: () => {},
        adopt: () => {},
    }));
}
