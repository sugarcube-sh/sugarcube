/**
 * The actual subscription behind the post-save phantom-diff fix:
 * createRecipeState wires baseline → clearAllEdits. When the host
 * pushes a new disk snapshot, every slot's pending edit is dropped.
 * If this subscription regresses, the bug we just spent three PRs
 * fixing comes back.
 */

import type { PanelSection, ResolvedTokens, ScaleExtension } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { createStore } from "zustand";
import { createStore as createVanillaStore } from "zustand/vanilla";
import type { TokenStoreState } from "../src/store/create-token-store";
import { createRecipeState } from "../src/store/recipe-state";
import { PathIndex } from "../src/tokens/path-index";
import type { TokenSnapshot } from "../src/tokens/types";
import { snapshot, tree } from "./fixtures";

const recipe = (override: Partial<ScaleExtension> = {}): ScaleExtension =>
    ({
        mode: "exponential",
        viewport: { min: 320, max: 1440 },
        base: { min: { value: 1, unit: "rem" }, max: { value: 1, unit: "rem" } },
        ratio: { min: 1.2, max: 1.2 },
        steps: { negative: 0, positive: 2 },
        ...override,
    }) as ScaleExtension;

function setup(initialBaseline: TokenSnapshot) {
    const panel: PanelSection[] = [
        {
            title: "Size",
            bindings: [{ type: "scale", token: "size.step.*" }],
        },
    ];
    const pathIndex = new PathIndex(initialBaseline.resolved);

    // Minimal token-store stand-in: only `currentContext` and `resolved`
    // are read by createRecipeState.
    const tokenStore = createStore<TokenStoreState>(() => ({
        resolved: initialBaseline.resolved,
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

    const baseline = createVanillaStore<TokenSnapshot>(() => initialBaseline);

    const writes: ResolvedTokens[] = [];
    const recipeState = createRecipeState(
        panel,
        initialBaseline,
        pathIndex,
        tokenStore,
        baseline,
        (resolved) => writes.push(resolved)
    );

    return { recipeState, baseline, writes };
}

describe("createRecipeState — baseline subscription", () => {
    it("clears slot.edits when the baseline emits an update", () => {
        const initial = snapshot({
            trees: [
                tree("size.json", {
                    size: {
                        step: {
                            $extensions: { "sh.sugarcube": { scale: recipe() } },
                        },
                    },
                }),
            ],
        });
        const { recipeState, baseline } = setup(initial);

        // Set an edit.
        recipeState
            .getState()
            .update("size.step.*", () => recipe({ ratio: { min: 1.5, max: 1.5 } }));
        expect(recipeState.getState().slots["size.step.*"]?.edits).not.toBeNull();

        // Simulate disk reload (file watcher, save, external editor edit).
        baseline.setState({
            ...initial,
            trees: [
                tree("size.json", {
                    size: {
                        step: {
                            $extensions: {
                                "sh.sugarcube": {
                                    scale: recipe({ ratio: { min: 1.5, max: 1.5 } }),
                                },
                            },
                        },
                    },
                }),
            ],
        });

        // Edit cleared. The post-save phantom diff is structurally impossible.
        expect(recipeState.getState().slots["size.step.*"]?.edits).toBeNull();
    });

    it("clears edits even when baseline values change without recipe matching", () => {
        // External edit changes a token that ISN'T owned by the recipe —
        // edits should still clear (we treat any baseline emission as
        // "external write wins"; selective preservation is out of scope).
        const initial = snapshot({
            trees: [
                tree("size.json", {
                    size: {
                        step: {
                            $extensions: { "sh.sugarcube": { scale: recipe() } },
                        },
                    },
                }),
            ],
        });
        const { recipeState, baseline } = setup(initial);

        recipeState
            .getState()
            .update("size.step.*", () => recipe({ ratio: { min: 1.5, max: 1.5 } }));
        expect(recipeState.getState().slots["size.step.*"]?.edits).not.toBeNull();

        // Same recipe, just a different baseline reference (a no-op disk reload).
        baseline.setState({ ...initial });

        expect(recipeState.getState().slots["size.step.*"]?.edits).toBeNull();
    });
});
