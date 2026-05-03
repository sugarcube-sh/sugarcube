/**
 * Zustand store for cascade-style scale bindings (hardcoded scales,
 * edited via base + spread sliders). Slots own only the user's pending
 * slider state; the captured baseline values are derived from the live
 * baseline per call (see scale-selectors.ts).
 *
 * Subscribes to baseline changes — when the host pushes a new disk
 * snapshot, all pending edits are blown away to match today's
 * "external write wins" semantics.
 */

import type { PanelSection, ResolvedTokens } from "@sugarcube-sh/core/client";
import { type StoreApi, createStore } from "zustand";
import type { PathIndex } from "../tokens/path-index";
import type { TokenSnapshot } from "../tokens/types";
import type { TokenStoreAPI } from "./create-token-store";
import { applyScaleOverlays } from "./scale-apply";
import { DEFAULT_SPREAD, selectCapture } from "./scale-selectors";
import type { LinkSlot, ScaleSlot } from "./scale-types";
import { subscribeBaselineEditClear } from "./subscribe-baseline-edit-clear";

export type ScaleStateStore = {
    scales: Record<string, ScaleSlot>;
    links: Record<string, LinkSlot>;
    setBase: (binding: string, value: number) => void;
    setSpread: (binding: string, value: number) => void;
    setLinkEnabled: (binding: string, enabled: boolean) => void;
    /** Clear every slot's edits. Used by the discard flow. */
    resetAll: () => void;
};

export type ScaleStateAPI = StoreApi<ScaleStateStore>;

export type ScaleWriteCallback = (resolved: ResolvedTokens) => void;

export function createScaleState(
    panelSections: PanelSection[],
    snapshot: TokenSnapshot,
    pathIndex: PathIndex,
    tokenStore: TokenStoreAPI,
    baseline: StoreApi<TokenSnapshot>,
    onWrite?: ScaleWriteCallback
): ScaleStateAPI {
    const writeResolved: ScaleWriteCallback =
        onWrite ?? ((resolved) => tokenStore.setState({ resolved }));

    const effectiveSpread = (edits: ScaleSlot["edits"]) => edits?.spread ?? DEFAULT_SPREAD;
    const effectiveBase = (slot: ScaleSlot, context: string): number =>
        slot.edits?.base ??
        selectCapture(baseline.getState(), pathIndex, slot.binding, context)?.baseMax ??
        0;

    const { scales, links } = buildSlots(panelSections);

    const scaleStore = createStore<ScaleStateStore>((set) => ({
        scales,
        links,

        setBase: (binding, value) => {
            set((state) => {
                const slot = state.scales[binding];
                if (!slot) return state;
                return {
                    scales: {
                        ...state.scales,
                        [binding]: {
                            ...slot,
                            edits: { base: value, spread: effectiveSpread(slot.edits) },
                        },
                    },
                };
            });
            applyAll();
        },

        setSpread: (binding, value) => {
            set((state) => {
                const slot = state.scales[binding];
                if (!slot) return state;
                return {
                    scales: {
                        ...state.scales,
                        [binding]: {
                            ...slot,
                            edits: {
                                base: effectiveBase(slot, tokenStore.getState().currentContext),
                                spread: value,
                            },
                        },
                    },
                };
            });
            applyAll();
        },

        setLinkEnabled: (binding, enabled) => {
            set((state) => {
                const slot = state.links[binding];
                if (!slot) return state;
                return {
                    links: { ...state.links, [binding]: { ...slot, edits: { enabled } } },
                };
            });
            applyAll();
        },

        resetAll: () => {
            set((state) => ({
                scales: clearEdits(state.scales),
                links: clearEdits(state.links),
            }));
        },
    }));

    function applyAll() {
        const { scales: currentScales, links: currentLinks } = scaleStore.getState();
        const { resolved, currentContext } = tokenStore.getState();
        const next = applyScaleOverlays(
            resolved,
            currentScales,
            currentLinks,
            baseline.getState(),
            pathIndex,
            currentContext
        );
        writeResolved(next);
    }

    // Re-apply on context change (slider values persist across switches).
    tokenStore.subscribe((state, prev) => {
        if (state.currentContext !== prev.currentContext) {
            applyAll();
        }
    });

    // Baseline change blows away pending edits — matches today's "external
    // write wins" semantics. Sliders snap back to derived defaults.
    subscribeBaselineEditClear(baseline, () => {
        scaleStore.setState((state) => ({
            scales: clearEdits(state.scales),
            links: clearEdits(state.links),
        }));
    });

    return scaleStore;
}

function buildSlots(panelSections: PanelSection[]): {
    scales: Record<string, ScaleSlot>;
    links: Record<string, LinkSlot>;
} {
    const scales: Record<string, ScaleSlot> = {};
    const linkBindings: Array<{ token: string; sourceBinding: string }> = [];

    for (const section of panelSections) {
        for (const binding of section.bindings) {
            if (binding.type === "scale" && binding.base) {
                scales[binding.token] = { binding, edits: null };
            } else if (binding.type === "scale-linked") {
                linkBindings.push({ token: binding.token, sourceBinding: binding.scalesWith });
            }
        }
    }

    // Resolve links after all scales are known so cross-references work
    // regardless of declaration order in the panel config.
    const links: Record<string, LinkSlot> = {};
    for (const { token, sourceBinding } of linkBindings) {
        if (!scales[sourceBinding]) continue;
        links[token] = { bindingToken: token, sourceBinding, edits: null };
    }

    return { scales, links };
}

function clearEdits<T extends { edits: unknown }>(slots: Record<string, T>): Record<string, T> {
    return Object.fromEntries(
        Object.entries(slots).map(([key, slot]) => [key, { ...slot, edits: null }])
    );
}

// Re-export for ScaleLinkedControl convenience.
export type { CapturedLinkedScale, CapturedScale } from "../tokens/scale-cascade";
