/**
 * Zustand store for recipe-driven scale bindings. Slots own only the
 * user's pending recipe override (`edits: ScaleExtension | null`); the
 * "original" recipe is derived from the live baseline on every read.
 *
 * Subscribes to baseline changes — when the host pushes a new disk
 * snapshot (file watcher, save, discard, external editor edit), all
 * pending edits are blown away to match today's "external write wins"
 * semantics. This is what makes the post-save phantom-diff bug
 * structurally impossible.
 */

import type { PanelSection, ResolvedTokens, ScaleExtension } from "@sugarcube-sh/core/client";
import { type StoreApi, createStore } from "zustand";
import type { PathIndex } from "../tokens/path-index";
import { getScaleExtension } from "../tokens/scale-extension";
import type { TokenSnapshot } from "../tokens/types";
import type { TokenStoreAPI } from "./create-token-store";
import { applyRecipeOverlay } from "./recipe-apply";
import { subscribeBaselineEditClear } from "./subscribe-baseline-edit-clear";

export type RecipeSlot = {
    /** The binding's `token` field — used as the slot key. */
    bindingToken: string;
    /** The group path where the recipe lives, e.g. "size.step". */
    parentPath: string;
    /** The JSON file path the recipe is authored in. */
    sourcePath: string;
    /** User's pending edit. Null = no override; effective recipe = the on-disk recipe. */
    edits: ScaleExtension | null;
};

export type RecipeStateStore = {
    slots: Record<string, RecipeSlot>;
    /**
     * Apply a functional update to a slot's recipe. The updater receives
     * the *effective* recipe (edits ?? on-disk original). The result is
     * stored in `edits` and live-applied to resolved.
     */
    update: (token: string, updater: (recipe: ScaleExtension) => ScaleExtension) => void;
    /** Clear every slot's edits. Used by the discard flow. */
    resetAll: () => void;
};

export type RecipeStateAPI = StoreApi<RecipeStateStore>;

export type RecipeWriteCallback = (resolved: ResolvedTokens) => void;

/** The recipe authored on disk for this slot, derived from the live baseline. */
export function selectOriginal(baseline: TokenSnapshot, slot: RecipeSlot): ScaleExtension | null {
    return getScaleExtension(baseline.trees, slot.parentPath) ?? null;
}

/** The effective recipe — the user's edit if present, otherwise the on-disk original. */
export function selectEffective(baseline: TokenSnapshot, slot: RecipeSlot): ScaleExtension | null {
    return slot.edits ?? selectOriginal(baseline, slot);
}

export function createRecipeState(
    panelSections: PanelSection[],
    snapshot: TokenSnapshot,
    pathIndex: PathIndex,
    tokenStore: TokenStoreAPI,
    baseline: StoreApi<TokenSnapshot>,
    onWrite?: RecipeWriteCallback
): RecipeStateAPI {
    const writeResolved: RecipeWriteCallback =
        onWrite ?? ((resolved) => tokenStore.setState({ resolved }));

    const recipeStore = createStore<RecipeStateStore>((set) => ({
        slots: buildInitialSlots(panelSections, snapshot),

        update: (token, updater) => {
            const slot = recipeStore.getState().slots[token];
            if (!slot) return;
            const effective = selectEffective(baseline.getState(), slot);
            if (!effective) return;
            const next = updater(effective);
            set((state) => ({
                slots: { ...state.slots, [token]: { ...slot, edits: next } },
            }));
            applyAll();
        },

        resetAll: () => {
            // Discard pairs this with the host's discard (DevTools) or the
            // local store reset (Embedded). Either way the working state
            // lands at baseline values; re-applying a now-null overlay is
            // a no-op, so we skip applyAll here.
            set((state) => ({ slots: clearEdits(state.slots) }));
        },
    }));

    function applyAll() {
        const { slots: currentSlots } = recipeStore.getState();
        const { resolved, currentContext } = tokenStore.getState();

        let next = resolved;
        for (const slot of Object.values(currentSlots)) {
            if (slot.edits === null) continue;
            next = applyRecipeOverlay(next, slot.edits, slot.parentPath, pathIndex, currentContext);
        }

        writeResolved(next);
    }

    // Re-apply on context change so slider edits propagate to the new
    // permutation's keys. Slot.edits persist across context switches —
    // a user-set base size is a global intent.
    tokenStore.subscribe((state, prev) => {
        if (state.currentContext !== prev.currentContext) {
            applyAll();
        }
    });

    // The load-bearing change for the staleness bug: after a save, edits
    // clear, baseline shows the saved values, diff machinery sees no
    // pending changes. No phantom diff possible.
    subscribeBaselineEditClear(baseline, () => {
        recipeStore.setState((state) => ({ slots: clearEdits(state.slots) }));
    });

    return recipeStore;
}

function buildInitialSlots(
    panelSections: PanelSection[],
    snapshot: TokenSnapshot
): Record<string, RecipeSlot> {
    const slots: Record<string, RecipeSlot> = {};

    for (const section of panelSections) {
        for (const binding of section.bindings) {
            if (binding.type !== "scale") continue;
            const parentPath = stripTrailingGlob(binding.token);
            const recipe = getScaleExtension(snapshot.trees, parentPath);
            if (!recipe) continue;

            slots[binding.token] = {
                bindingToken: binding.token,
                parentPath,
                sourcePath: findSourcePath(snapshot, parentPath),
                edits: null,
            };
        }
    }

    return slots;
}

function stripTrailingGlob(pattern: string): string {
    return pattern.endsWith(".*") ? pattern.slice(0, -2) : pattern;
}

/** Walk the snapshot's trees to find which file authored the group at `parentPath`. */
function findSourcePath(snapshot: TokenSnapshot, parentPath: string): string {
    const segments = parentPath.split(".");
    for (const tree of snapshot.trees) {
        let node: unknown = tree.tokens;
        let found = true;
        for (const segment of segments) {
            if (!node || typeof node !== "object") {
                found = false;
                break;
            }
            node = (node as Record<string, unknown>)[segment];
        }
        if (found && node && typeof node === "object") return tree.sourcePath;
    }
    return snapshot.trees[0]?.sourcePath ?? "";
}

function clearEdits(slots: Record<string, RecipeSlot>): Record<string, RecipeSlot> {
    return Object.fromEntries(
        Object.entries(slots).map(([key, slot]) => [key, { ...slot, edits: null }])
    );
}
