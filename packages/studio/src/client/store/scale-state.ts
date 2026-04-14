import type { PanelSection } from "@sugarcube-sh/core/client";
import { type StoreApi, createStore } from "zustand";
import type { PathIndex } from "../../store/path-index";
import {
    type CapturedLinkedScale,
    type CapturedScale,
    applyLinkedScaleToResolved,
    applyScaleToResolved,
    captureLinkedScale,
    captureScale,
} from "../../store/scale-cascade";
import type { TokenSnapshot, TokenUpdate } from "../../store/types";
import type { TokenStoreAPI } from "./create-token-store";

const DEFAULT_SPREAD = 1;

type ScaleSlot = {
    scale: CapturedScale;
    base: number;
    spread: number;
};

type LinkSlot = {
    scale: CapturedLinkedScale;
    source: string;
    sourceDefaultBase: number;
    enabled: boolean;
};

export type ScaleStateStore = {
    scales: Record<string, ScaleSlot>;
    links: Record<string, LinkSlot>;
    setBase: (binding: string, value: number) => void;
    setSpread: (binding: string, value: number) => void;
    setLinkEnabled: (binding: string, enabled: boolean) => void;
};

export type ScaleStateAPI = StoreApi<ScaleStateStore>;

/**
 * Factory that creates a scale state store from the panel config,
 * snapshot, and path index. Captures all scales at creation time.
 *
 * The `tokenStore` parameter is used by `applyAll` to write back
 * computed token values in one atomic update.
 */
/**
 * Optional callback for routing scale writes externally (e.g. via RPC in DevTools mode).
 * When provided, applyAll sends the changed token entries (key → full token object)
 * through this callback instead of writing to the local token store.
 */
export type ScaleApplyCallback = (
    changes: Array<{ key: string; token: Record<string, unknown> }>
) => void;

export function createScaleState(
    panelSections: PanelSection[],
    snapshot: TokenSnapshot,
    pathIndex: PathIndex,
    tokenStore: TokenStoreAPI,
    onApply?: ScaleApplyCallback
): ScaleStateAPI {
    const { scales, links } = buildInitialState(panelSections, snapshot, pathIndex);

    function applyAll() {
        const { scales: currentScales, links: currentLinks } = scaleStore.getState();

        // Compute the new resolved state by applying all scales + links
        let next = tokenStore.getState().resolved;

        for (const slot of Object.values(currentScales)) {
            next = applyScaleToResolved(next, slot.scale, slot.base, slot.spread, pathIndex);
        }

        for (const link of Object.values(currentLinks)) {
            const sourceSlot = currentScales[link.source];
            if (!sourceSlot) continue;
            const factor = sourceSlot.base / link.sourceDefaultBase;
            next = applyLinkedScaleToResolved(next, link.scale, factor, link.enabled, pathIndex);
        }

        if (onApply) {
            // DevTools mode: find changed tokens and send full objects
            const changes: Array<{ key: string; token: Record<string, unknown> }> = [];
            const current = tokenStore.getState().resolved;
            for (const [key, token] of Object.entries(next)) {
                if (!token || !("$value" in token)) continue;
                const original = current[key];
                if (!original || !("$value" in original)) continue;
                // Compare the full token, not just $value — extensions matter
                if (JSON.stringify(token) !== JSON.stringify(original)) {
                    changes.push({ key, token: token as Record<string, unknown> });
                }
            }
            onApply(changes);
        } else {
            // Embedded mode: write directly to the local store
            tokenStore.setState({ resolved: next });
        }
    }

    const scaleStore = createStore<ScaleStateStore>((set) => ({
        scales,
        links,

        setBase: (binding, value) => {
            set((state) => {
                const slot = state.scales[binding];
                if (!slot) return state;
                return {
                    scales: { ...state.scales, [binding]: { ...slot, base: value } },
                };
            });
            applyAll();
        },

        setSpread: (binding, value) => {
            set((state) => {
                const slot = state.scales[binding];
                if (!slot) return state;
                return {
                    scales: { ...state.scales, [binding]: { ...slot, spread: value } },
                };
            });
            applyAll();
        },

        setLinkEnabled: (binding, enabled) => {
            set((state) => {
                const slot = state.links[binding];
                if (!slot) return state;
                return {
                    links: { ...state.links, [binding]: { ...slot, enabled } },
                };
            });
            applyAll();
        },
    }));

    return scaleStore;
}

function buildInitialState(
    panelSections: PanelSection[],
    snapshot: TokenSnapshot,
    pathIndex: PathIndex
): Pick<ScaleStateStore, "scales" | "links"> {
    const scales: Record<string, ScaleSlot> = {};
    const links: Record<string, LinkSlot> = {};

    for (const section of panelSections) {
        if (section.type === "palette-swap") continue;
        for (const binding of section.bindings) {
            if (binding.type !== "scale" || !binding.base) continue;
            const captured = captureScale(
                binding.token,
                binding.base,
                snapshot.resolved,
                pathIndex
            );
            if (!captured) continue;
            scales[binding.token] = {
                scale: captured,
                base: captured.baseMax,
                spread: DEFAULT_SPREAD,
            };
        }
    }

    for (const section of panelSections) {
        if (section.type === "palette-swap") continue;
        for (const binding of section.bindings) {
            if (!binding.scalesWith) continue;
            const sourceSlot = scales[binding.scalesWith];
            if (!sourceSlot) continue;
            links[binding.token] = {
                scale: captureLinkedScale(binding.token, snapshot.resolved, pathIndex),
                source: binding.scalesWith,
                sourceDefaultBase: sourceSlot.scale.baseMax,
                enabled: true,
            };
        }
    }

    return { scales, links };
}
