import type { PanelSection, ResolvedTokens, ScaleExtension } from "@sugarcube-sh/core/client";
import { type StoreApi, createStore } from "zustand";
import type { PathIndex } from "../tokens/path-index";
import { getScaleExtension } from "../tokens/scale-extension";
import type { TokenSnapshot } from "../tokens/types";
import type { TokenStoreAPI } from "./create-token-store";
import { applyRecipeOverlay } from "./recipe-apply";
import { subscribeBaselineEditClear } from "./subscribe-baseline-edit-clear";

export type RecipeSlot = {
    bindingToken: string;
    parentPath: string;
    sourcePath: string;
    edits: ScaleExtension | null;
};

export type RecipeStateStore = {
    slots: Record<string, RecipeSlot>;
    update: (token: string, updater: (recipe: ScaleExtension) => ScaleExtension) => void;
    resetAll: () => void;
};

export type RecipeStateAPI = StoreApi<RecipeStateStore>;

export type RecipeWriteCallback = (resolved: ResolvedTokens) => void;

export function selectOriginal(baseline: TokenSnapshot, slot: RecipeSlot): ScaleExtension | null {
    return getScaleExtension(baseline.trees, slot.parentPath) ?? null;
}

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

    tokenStore.subscribe((state, prev) => {
        if (state.currentContext !== prev.currentContext) {
            applyAll();
        }
    });

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
