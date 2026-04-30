import {
    type PanelSection,
    type ResolvedTokens,
    type ScaleExtension,
    calculateScale,
    isResolvedToken,
} from "@sugarcube-sh/core/client";
import { type StoreApi, createStore } from "zustand";
import type { PathIndex } from "../tokens/path-index";
import { getScaleExtension } from "../tokens/scale-extension";
import type { TokenSnapshot } from "../tokens/types";
import type { TokenStoreAPI } from "./create-token-store";

type Dim = { value: number; unit: "rem" | "px" };

export type RecipeSlot = {
    /** The binding's `token` field — used as the slot key. */
    bindingToken: string;
    /** The group path where the recipe lives, e.g. "size.step". */
    parentPath: string;
    /** The JSON file path the recipe is authored in. */
    sourcePath: string;
    /** The recipe captured from the snapshot — never mutated. */
    original: ScaleExtension;
    /** The recipe currently being edited. Updated by `update`. */
    current: ScaleExtension;
};

export type RecipeStateStore = {
    slots: Record<string, RecipeSlot>;
    /**
     * Apply a functional update to a recipe. Live preview tokens are
     * regenerated and written to resolved on every call.
     */
    update: (token: string, updater: (recipe: ScaleExtension) => ScaleExtension) => void;
    /**
     * Revert every slot's `current` to its `original`. Pairs with the
     * token store's `resetAll` for the discard-changes flow — call both
     * and the studio is back to its snapshot baseline.
     */
    resetAll: () => void;
};

export type RecipeStateAPI = StoreApi<RecipeStateStore>;

export type RecipeWriteCallback = (resolved: ResolvedTokens) => void;

/**
 * Captures recipe-driven scale bindings from the snapshot and exposes a
 * mutation surface that updates resolved tokens live as the user edits.
 *
 * Parallels `createScaleState` (cascade) — same pattern: build slots
 * from panel bindings, mutate via setter actions, apply on every change.
 */
export function createRecipeState(
    panelSections: PanelSection[],
    snapshot: TokenSnapshot,
    pathIndex: PathIndex,
    tokenStore: TokenStoreAPI,
    onWrite?: RecipeWriteCallback
): RecipeStateAPI {
    const slots = buildInitialSlots(panelSections, snapshot);

    const writeResolved: RecipeWriteCallback =
        onWrite ?? ((resolved) => tokenStore.setState({ resolved }));

    const recipeStore = createStore<RecipeStateStore>((set) => ({
        slots,
        update: (token, updater) => {
            set((state) => {
                const slot = state.slots[token];
                if (!slot) return state;
                return {
                    slots: { ...state.slots, [token]: { ...slot, current: updater(slot.current) } },
                };
            });
            applyAll();
        },
        resetAll: () => {
            // Revert every slot to its captured original. We deliberately
            // skip applyAll here — discard pairs this with the token
            // store's resetAll, which has already restored resolved to
            // the snapshot. Re-applying would just rewrite the same values.
            set((state) => ({
                slots: Object.fromEntries(
                    Object.entries(state.slots).map(([key, slot]) => [
                        key,
                        { ...slot, current: slot.original },
                    ])
                ),
            }));
        },
    }));

    function applyAll() {
        const { slots: currentSlots } = recipeStore.getState();
        const { resolved, currentContext } = tokenStore.getState();

        let next = resolved;
        for (const slot of Object.values(currentSlots)) {
            next = applyRecipeToResolved(next, slot, pathIndex, currentContext);
        }

        writeResolved(next);
    }

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

            const sourcePath = findSourcePath(snapshot, parentPath);
            slots[binding.token] = {
                bindingToken: binding.token,
                parentPath,
                sourcePath,
                original: recipe,
                current: recipe,
            };
        }
    }

    return slots;
}

function stripTrailingGlob(pattern: string): string {
    return pattern.endsWith(".*") ? pattern.slice(0, -2) : pattern;
}

function findSourcePath(snapshot: TokenSnapshot, parentPath: string): string {
    // Walk the snapshot's trees to find which file authored the group at parentPath.
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

function applyRecipeToResolved(
    resolved: ResolvedTokens,
    slot: RecipeSlot,
    pathIndex: PathIndex,
    context: string
): ResolvedTokens {
    const steps = calculateScale(slot.current);
    const updates: ResolvedTokens = {};

    for (const step of steps) {
        const stepPath = `${slot.parentPath}.${step.name}`;
        const entries = pathIndex.entriesFor(stepPath).filter((e) => e.context === context);
        for (const { key } of entries) {
            const next = buildRecipeDimensionToken(
                resolved[key],
                step.min,
                step.max,
                slot.current.viewport
            );
            if (next) updates[key] = next;
        }
    }

    return { ...resolved, ...updates };
}

function buildRecipeDimensionToken(
    existing: ResolvedTokens[string] | undefined,
    min: Dim,
    max: Dim,
    viewport: { min: number; max: number }
): ResolvedTokens[string] | null {
    if (!isResolvedToken(existing)) return null;

    const existingSugarcube = (existing.$extensions?.["sh.sugarcube"] ?? {}) as Record<
        string,
        unknown
    >;

    return {
        ...existing,
        $value: max,
        $resolvedValue: max,
        $extensions: {
            ...existing.$extensions,
            "sh.sugarcube": {
                ...existingSugarcube,
                fluid: { min, max, viewport },
            },
        },
    } as ResolvedTokens[string];
}
