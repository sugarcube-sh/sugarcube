import { create } from "zustand";
import { PANEL_CONFIG } from "../data/panel-config";
import { useTokenStore } from "../store/TokenStore";
import {
    type CapturedLinkedScale,
    type CapturedScale,
    applyLinkedScaleToResolved,
    applyScaleToResolved,
    captureLinkedScale,
    captureScale,
} from "../store/scale-cascade";

/**
 * Shared state for scale-related controls.
 *
 * All captured scales and linked-scale groups are computed ONCE at
 * module load by walking the panel config. Controls read their state
 * from this store without needing to register at mount — no useEffect
 * chains, no "slot is undefined on first render" fallback, no ordering
 * issues between linked controls and their sources.
 *
 * Slider positions (base/spread/enabled) also live here so that the
 * `applyAll` pass can iterate every registered scale in one atomic
 * token-store update, and so that linked bindings can look up the
 * source binding's current base when computing their scale factor.
 *
 * React state is reserved for the UI inputs that the user can wiggle
 * — the captured scales are derived data, they never change after
 * module load.
 */

const DEFAULT_SPREAD = 1;

type ScaleSlot = {
    /** Captured scale from the snapshot (immutable). */
    scale: CapturedScale;
    /** Current slider position for `base` (defaults to snapshot baseMax). */
    base: number;
    /** Current slider position for `spread` (defaults to 1). */
    spread: number;
};

type LinkSlot = {
    /** Captured static group from the snapshot (immutable). */
    scale: CapturedLinkedScale;
    /** The source binding's token path (e.g. `"size.step.*"`). */
    source: string;
    /** The source binding's default base, used to compute the factor. */
    sourceDefaultBase: number;
    /** Whether the link is currently active. */
    enabled: boolean;
};

type ScaleStateStore = {
    /** Cascade scales from the panel config, keyed by `binding.token`. */
    scales: Record<string, ScaleSlot>;
    /** Linked scales from the panel config, keyed by `binding.token`. */
    links: Record<string, LinkSlot>;

    /** Update the `base` slider for a registered scale. */
    setBase: (binding: string, value: number) => void;
    /** Update the `spread` slider for a registered scale. */
    setSpread: (binding: string, value: number) => void;
    /** Toggle a linked scale on or off. */
    setLinkEnabled: (binding: string, enabled: boolean) => void;
};

/**
 * Walk the panel config at module load and pre-capture every scale and
 * linked-scale group. Runs once — the captured data is pure (derived
 * from the snapshot and config), so there's no reason to defer it to
 * mount time.
 */
function buildInitialState(): Pick<ScaleStateStore, "scales" | "links"> {
    const scales: Record<string, ScaleSlot> = {};
    const links: Record<string, LinkSlot> = {};

    const sections = PANEL_CONFIG.panel ?? [];

    // Pass 1: capture cascade scales so link resolution has sources.
    for (const section of sections) {
        if (section.type === "palette-swap") continue;
        for (const binding of section.bindings) {
            if (binding.type !== "scale" || !binding.base) continue;
            const captured = captureScale(binding.token, binding.base);
            if (!captured) {
                // eslint-disable-next-line no-console
                console.warn(
                    `[tweakpane] couldn't capture scale for "${binding.token}" with base "${binding.base}"`
                );
                continue;
            }
            scales[binding.token] = {
                scale: captured,
                base: captured.baseMax,
                spread: DEFAULT_SPREAD,
            };
        }
    }

    // Pass 2: capture linked groups and wire them to their source scales.
    for (const section of sections) {
        if (section.type === "palette-swap") continue;
        for (const binding of section.bindings) {
            if (!binding.scalesWith) continue;
            const sourceSlot = scales[binding.scalesWith];
            if (!sourceSlot) {
                // eslint-disable-next-line no-console
                console.warn(
                    `[tweakpane] linked scale "${binding.token}" references unknown source "${binding.scalesWith}"`
                );
                continue;
            }
            links[binding.token] = {
                scale: captureLinkedScale(binding.token),
                source: binding.scalesWith,
                sourceDefaultBase: sourceSlot.scale.baseMax,
                enabled: true,
            };
        }
    }

    return { scales, links };
}

export const useScaleState = create<ScaleStateStore>((set) => ({
    ...buildInitialState(),

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

/**
 * Apply every cascade and linked scale to the token store in one
 * atomic update. The pipeline runs once per user interaction, not
 * once per scale.
 */
function applyAll() {
    const { scales, links } = useScaleState.getState();

    useTokenStore.setState((state) => {
        let next = state.resolved;

        for (const slot of Object.values(scales)) {
            next = applyScaleToResolved(next, slot.scale, slot.base, slot.spread);
        }

        for (const link of Object.values(links)) {
            const sourceSlot = scales[link.source];
            if (!sourceSlot) continue;
            const factor = sourceSlot.base / link.sourceDefaultBase;
            next = applyLinkedScaleToResolved(next, link.scale, factor, link.enabled);
        }

        return { resolved: next };
    });
}
