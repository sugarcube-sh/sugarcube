import {
    type PanelSection,
    type ResolvedTokens,
    type ScaleExtension,
    isResolvedToken,
} from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { createStore } from "zustand";
import { createStore as createVanillaStore } from "zustand/vanilla";
import type { TokenStoreState } from "../src/store/create-token-store";
import { createScaleState, selectScaleFieldEdited } from "../src/store/scale-state";
import { computeDiff } from "../src/tokens/compute-diff";
import { PathIndex } from "../src/tokens/path-index";
import type { TokenSnapshot } from "../src/tokens/types";
import { resolved, snapshot, tree } from "./fixtures";

const TOKEN = "size.step.*";

const makeScale = (override: Partial<ScaleExtension> = {}): ScaleExtension =>
    ({
        mode: "exponential",
        base: { min: { value: 1, unit: "rem" }, max: { value: 1, unit: "rem" } },
        ratio: { min: 1.2, max: 1.2 },
        steps: { negative: 0, positive: 2 },
        ...override,
    }) as ScaleExtension;

function setup() {
    const initial: TokenSnapshot = snapshot({
        trees: [
            tree("size.json", {
                size: { step: { $extensions: { "sh.sugarcube": { scale: makeScale() } } } },
            }),
        ],
        resolved: resolved(
            { path: "size.step.0", value: { value: 1, unit: "rem" } },
            { path: "size.step.1", value: { value: 1.2, unit: "rem" } },
        ),
    });

    const panel: PanelSection[] = [
        { title: "Size", bindings: [{ type: "scale", token: TOKEN, base: "size.step.0" }] },
    ];
    const pathIndex = new PathIndex(initial.resolved);

    const tokenStore = createStore<TokenStoreState>(() => ({
        resolved: initial.resolved,
        css: null,
        isComputing: false,
        error: null,
        lastRunMs: null,
        currentContext: "default",
        setCurrentContext: () => {},
        getToken: () => undefined,
        setToken: () => {},
        setTokens: () => {},
        resetToken: () => {},
        discard: async () => {},
    }));

    const baseline = createVanillaStore<TokenSnapshot>(() => initial);

    const writes: ResolvedTokens[] = [];
    const { store } = createScaleState(
        panel,
        initial,
        () => pathIndex,
        tokenStore,
        baseline,
        (next) => writes.push(next),
    );

    return { store, writes, baselineSnapshot: initial, pathIndex };
}

describe("createScaleState - clearEditField", () => {
    const edited = (store: ReturnType<typeof setup>["store"], field: "ratio" | "base") => {
        const edit = store.getState().edits[TOKEN];
        const effective = edit?.kind === "scale" ? edit.scale : makeScale();
        return selectScaleFieldEdited(effective, makeScale(), field);
    };

    it("reverts only the named knob, leaving the other edited", () => {
        const { store } = setup();

        store.getState().updateScale(TOKEN, (s) => ({ ...s, ratio: { min: 1.5, max: 1.5 } }));
        store.getState().updateScale(TOKEN, (s) => ({
            ...s,
            base: { min: { value: 2, unit: "rem" }, max: { value: 2, unit: "rem" } },
        }));
        expect(edited(store, "ratio")).toBe(true);
        expect(edited(store, "base")).toBe(true);

        store.getState().clearEditField(TOKEN, "ratio");

        expect(edited(store, "ratio")).toBe(false);
        expect(edited(store, "base")).toBe(true);
    });

    it("writes the reverted tokens, not just an amended edit", () => {
        const { store, writes } = setup();

        store.getState().updateScale(TOKEN, (s) => ({ ...s, ratio: { min: 1.5, max: 1.5 } }));
        const afterEdit = writes.length;

        store.getState().clearEditField(TOKEN, "ratio");

        expect(writes.length).toBe(afterEdit + 1);
    });

    it("does not report a knob as edited just because a sibling was written", () => {
        const { store } = setup();

        store.getState().updateScale(TOKEN, (s) => ({ ...s, ratio: { min: 1.5, max: 1.5 } }));

        expect(store.getState().edits[TOKEN]).toBeDefined();
        expect(edited(store, "ratio")).toBe(true);
        expect(edited(store, "base")).toBe(false);
    });

    it("drops a direct-mode entry once its last field is cleared", () => {
        const { store } = setup();

        store.getState().setBase(TOKEN, 1.5);
        store.getState().clearEditField(TOKEN, "base");

        expect(store.getState().edits[TOKEN]).toBeUndefined();
    });

    it("reports no pending change once the last edited knob is restored", () => {
        const { store, baselineSnapshot, pathIndex } = setup();

        store.getState().updateScale(TOKEN, (s) => ({ ...s, ratio: { min: 1.5, max: 1.5 } }));
        const { edits: dirty, bindings } = store.getState();
        expect(
            computeDiff(baselineSnapshot.resolved, baselineSnapshot, pathIndex, dirty, bindings),
        ).not.toHaveLength(0);

        store.getState().clearEditField(TOKEN, "ratio");

        const { edits: restored } = store.getState();
        expect(restored[TOKEN]).toBeDefined(); // the entry lingers …
        expect(
            computeDiff(baselineSnapshot.resolved, baselineSnapshot, pathIndex, restored, bindings),
        ).toHaveLength(0); // … but nothing reports it as a change
    });

    it("is harmless for a token with no edit", () => {
        const { store } = setup();

        expect(() => store.getState().clearEditField("nothing.here.*", "base")).not.toThrow();
        expect(store.getState().edits).toEqual({});
    });
});

const SPACE = "space.*";

function setupDirect() {
    const initial: TokenSnapshot = snapshot({
        trees: [tree("space.json", { space: {} })],
        resolved: resolved(
            { path: "space.sm", value: { value: 1, unit: "rem" } },
            { path: "space.md", value: { value: 2, unit: "rem" } },
        ),
    });

    const panel: PanelSection[] = [
        { title: "Space", bindings: [{ type: "scale", token: SPACE, base: "space.sm" }] },
    ];
    const pathIndex = new PathIndex(initial.resolved);

    const tokenStore = createStore<TokenStoreState>(() => ({
        resolved: initial.resolved,
        css: null,
        isComputing: false,
        error: null,
        lastRunMs: null,
        currentContext: "default",
        setCurrentContext: () => {},
        getToken: () => undefined,
        setToken: () => {},
        setTokens: () => {},
        resetToken: () => {},
        discard: async () => {},
    }));

    const baseline = createVanillaStore<TokenSnapshot>(() => initial);

    const writes: ResolvedTokens[] = [];
    const { store } = createScaleState(
        panel,
        initial,
        () => pathIndex,
        tokenStore,
        baseline,
        (next) => {
            writes.push(next);
            tokenStore.setState({ resolved: next });
        },
    );

    return { store, writes, baselineSnapshot: initial };
}

function stepValue(tokens: ResolvedTokens, path: string) {
    const token = tokens[`default::${path}`];
    if (!isResolvedToken(token)) throw new Error(`no resolved token at ${path}`);
    return (token.$value as { value: number }).value;
}

describe("createScaleState - clearEditField, direct mode", () => {
    it("restores the token values, not just the edit record", () => {
        const { store, writes, baselineSnapshot } = setupDirect();
        const original = stepValue(baselineSnapshot.resolved, "space.md");

        store.getState().setBase(SPACE, 1.5);
        expect(stepValue(writes.at(-1) as ResolvedTokens, "space.md")).not.toBe(original);

        store.getState().clearEditField(SPACE, "base");

        expect(stepValue(writes.at(-1) as ResolvedTokens, "space.md")).toBe(original);
    });
});
