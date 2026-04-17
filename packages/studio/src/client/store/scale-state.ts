import type { ResolvedTokens } from "@sugarcube-sh/core";
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
import type { TokenSnapshot } from "../../store/types";
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
 * Callback that receives the fully-computed resolved map after every
 * scale change. The caller decides how to write it (sharedState.mutate
 * in DevTools, tokenStore.setState in embedded).
 */
export type ScaleWriteCallback = (resolved: ResolvedTokens) => void;

export function createScaleState(
    panelSections: PanelSection[],
    snapshot: TokenSnapshot,
    pathIndex: PathIndex,
    tokenStore: TokenStoreAPI,
    onWrite?: ScaleWriteCallback
): ScaleStateAPI {
    const { scales, links } = buildInitialState(panelSections, snapshot, pathIndex);

    /** Default writer: set resolved directly on the local token store. */
    const writeResolved: ScaleWriteCallback =
        onWrite ?? ((resolved) => tokenStore.setState({ resolved }));

    function applyAll() {
        const { scales: currentScales, links: currentLinks } = scaleStore.getState();

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

        writeResolved(next);
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
        for (const binding of section.bindings) {
            if (binding.type !== "scale-linked") continue;
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
