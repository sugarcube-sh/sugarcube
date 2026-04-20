import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import type { PanelSection } from "@sugarcube-sh/core/client";
import { type StoreApi, createStore } from "zustand";
import type { PathIndex } from "../tokens/path-index";
import {
    type CapturedLinkedScale,
    type CapturedScale,
    applyLinkedScaleToResolved,
    applyScaleToResolved,
    captureLinkedScale,
    captureScale,
} from "../tokens/scale-cascade";
import type { TokenSnapshot } from "../tokens/types";
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

/** Receives the computed resolved map after every scale change. Writing is the caller's job. */
export type ScaleWriteCallback = (resolved: ResolvedTokens) => void;

/**
 * Create a scale state store. Captures every scale binding against the
 * active permutation context, and recaptures on context change — slider
 * values (base/spread/enabled) are preserved across switches.
 */
export function createScaleState(
    panelSections: PanelSection[],
    snapshot: TokenSnapshot,
    pathIndex: PathIndex,
    tokenStore: TokenStoreAPI,
    onWrite?: ScaleWriteCallback
): ScaleStateAPI {
    const initialContext = tokenStore.getState().currentContext;
    const { scales, links } = buildInitialState(panelSections, snapshot, pathIndex, initialContext);

    /** Default writer: set resolved directly on the local token store. */
    const writeResolved: ScaleWriteCallback =
        onWrite ?? ((resolved) => tokenStore.setState({ resolved }));

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

    function applyAll() {
        const { scales: currentScales, links: currentLinks } = scaleStore.getState();
        const { resolved, currentContext } = tokenStore.getState();

        let next = resolved;

        for (const slot of Object.values(currentScales)) {
            next = applyScaleToResolved(
                next,
                slot.scale,
                slot.base,
                slot.spread,
                pathIndex,
                currentContext
            );
        }

        for (const link of Object.values(currentLinks)) {
            const sourceSlot = currentScales[link.source];
            if (!sourceSlot) continue;
            const factor = sourceSlot.base / link.sourceDefaultBase;
            next = applyLinkedScaleToResolved(
                next,
                link.scale,
                factor,
                link.enabled,
                pathIndex,
                currentContext
            );
        }

        writeResolved(next);
    }

    /** Rebuild captures for the given context, preserving slider values. */
    function recaptureAll(context: string) {
        const next = buildInitialState(panelSections, snapshot, pathIndex, context);
        scaleStore.setState((s) => ({
            scales: Object.fromEntries(
                Object.entries(next.scales).map(([key, slot]) => {
                    const existing = s.scales[key];
                    return [
                        key,
                        existing ? { ...slot, base: existing.base, spread: existing.spread } : slot,
                    ];
                })
            ),
            links: Object.fromEntries(
                Object.entries(next.links).map(([key, slot]) => {
                    const existing = s.links[key];
                    return [key, existing ? { ...slot, enabled: existing.enabled } : slot];
                })
            ),
        }));
        applyAll();
    }

    // Subscription lives for the session — scale state is created once
    // and never torn down.
    tokenStore.subscribe((state, prev) => {
        if (state.currentContext !== prev.currentContext) {
            recaptureAll(state.currentContext);
        }
    });

    return scaleStore;
}

function buildInitialState(
    panelSections: PanelSection[],
    snapshot: TokenSnapshot,
    pathIndex: PathIndex,
    context: string
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
                pathIndex,
                context
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
                scale: captureLinkedScale(binding.token, snapshot.resolved, pathIndex, context),
                source: binding.scalesWith,
                sourceDefaultBase: sourceSlot.scale.baseMax,
                enabled: true,
            };
        }
    }

    return { scales, links };
}
