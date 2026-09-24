import type {
    PanelSection,
    ResolvedTokens,
    ScaleBinding,
    ScaleExtension,
} from "@sugarcube-sh/core/client";
import { type StoreApi, createStore } from "zustand";
import type { PathIndexAccessor } from "../tokens/path-index";
import { getScaleBase, getScaleExtension } from "../tokens/scale-extension";
import type { TokenSnapshot } from "../tokens/types";
import type { TokenStoreAPI } from "./create-source-store";
import { type PanelOwnership, conflictMessage, indexPanelOwnership } from "./panel-ownership";
import { applyScaleEdits } from "./scale-apply";
import { DEFAULT_SPREAD, selectCapture } from "./scale-selectors";
import type {
    LinkBindingMeta,
    LinkEdit,
    ScaleBindingMeta,
    ScaleEdit,
    ScaleEditField,
    StepOverrides,
} from "./scale-types";

export type ScaleStateStore = {
    edits: Record<string, ScaleEdit>;
    links: Record<string, LinkEdit>;
    bindings: Record<string, ScaleBindingMeta>;
    linkBindings: Record<string, LinkBindingMeta>;
    bases: Record<string, string>;
    authoredBases: Record<string, string>;

    setScaleBase: (token: string, basePath: string) => void;
    setBase: (token: string, value: number) => void;
    setSpread: (token: string, value: number) => void;
    setStepOverride: (
        token: string,
        step: string,
        value: { min: { value: number; unit: string }; max: { value: number; unit: string } },
    ) => void;
    clearStepOverride: (token: string, step: string) => void;
    updateScale: (token: string, updater: (scale: ScaleExtension) => ScaleExtension) => void;
    setLinkEnabled: (token: string, enabled: boolean) => void;
    clearEditField: (token: string, field: ScaleEditField) => void;
    resetAll: () => void;
};

export type ScaleStateAPI = StoreApi<ScaleStateStore>;

export type ScaleStateHandle = {
    store: ScaleStateAPI;
    activate: () => () => void;
};

export type ScaleWriteCallback = (resolved: ResolvedTokens) => void;

export function selectOriginalScale(
    baseline: TokenSnapshot,
    parentPath: string,
): ScaleExtension | null {
    return getScaleExtension(baseline.trees, parentPath) ?? null;
}

export function selectEffectiveScale(
    baseline: TokenSnapshot,
    edit: ScaleEdit | undefined,
    parentPath: string,
): ScaleExtension | null {
    if (edit?.kind === "scale") return edit.scale;
    return selectOriginalScale(baseline, parentPath);
}

export function restoreScaleField(
    current: ScaleExtension,
    original: ScaleExtension,
    field: ScaleEditField,
): ScaleExtension {
    if (typeof field === "object") {
        if (current.mode !== "multipliers" || original.mode !== "multipliers") return current;
        const restored = original.multipliers[field.multiplier];
        if (restored === undefined) return current;
        return {
            ...current,
            multipliers: { ...current.multipliers, [field.multiplier]: restored },
        };
    }

    if (field === "base") return { ...current, base: original.base };
    if (field === "baseMin")
        return { ...current, base: { ...current.base, min: original.base.min } };
    if (field === "baseMax")
        return { ...current, base: { ...current.base, max: original.base.max } };

    if (current.mode !== "exponential" || original.mode !== "exponential") return current;
    if (field === "ratioMin") {
        return { ...current, ratio: { ...current.ratio, min: original.ratio.min } };
    }
    if (field === "ratioMax") {
        return { ...current, ratio: { ...current.ratio, max: original.ratio.max } };
    }
    return current;
}

export function selectScaleFieldEdited(
    effective: ScaleExtension | null,
    original: ScaleExtension | null,
    field: ScaleEditField,
): boolean {
    if (!effective || !original) return false;

    if (typeof field === "object") {
        if (effective.mode !== "multipliers" || original.mode !== "multipliers") return false;
        return effective.multipliers[field.multiplier] !== original.multipliers[field.multiplier];
    }

    if (field === "base") return effective.base.max.value !== original.base.max.value;
    if (field === "baseMin") return effective.base.min.value !== original.base.min.value;
    if (field === "baseMax") return effective.base.max.value !== original.base.max.value;

    if (effective.mode !== "exponential" || original.mode !== "exponential") return false;
    if (field === "ratioMin") return effective.ratio.min !== original.ratio.min;
    if (field === "ratioMax") return effective.ratio.max !== original.ratio.max;
    return false;
}

export function createScaleState(
    panelSections: PanelSection[],
    snapshot: TokenSnapshot,
    getPathIndex: PathIndexAccessor,
    tokenStore: TokenStoreAPI,
    baseline: StoreApi<TokenSnapshot>,
    writeResolved: ScaleWriteCallback,
): ScaleStateHandle {
    const ownership = indexPanelOwnership(panelSections, getPathIndex());
    for (const conflict of ownership.conflicts) console.warn(conflictMessage(conflict));

    const { bindings, linkBindings } = collectBindings(panelSections, snapshot, ownership);

    const authoredBases: Record<string, string> = {};
    for (const [token, meta] of Object.entries(bindings)) {
        const authored = getScaleBase(snapshot.trees, meta.parentPath);
        if (authored) authoredBases[token] = authored;
    }

    const effectiveBase = (token: string, edit: ScaleEdit | undefined, context: string): number => {
        if (edit?.kind === "tokens" && edit.base !== undefined) return edit.base;
        const meta = bindings[token];
        if (!meta) return 0;
        return (
            selectCapture(
                baseline.getState(),
                getPathIndex(),
                meta.binding,
                context,
                scaleStore.getState().bases[token],
            )?.baseMax ?? 0
        );
    };

    const scaleStore = createStore<ScaleStateStore>((set) => ({
        edits: {},
        links: {},
        bindings,
        linkBindings,
        bases: { ...authoredBases },
        authoredBases,

        setScaleBase: (token, basePath) => {
            set((state) => ({ bases: { ...state.bases, [token]: basePath } }));
            applyAll();
        },

        setBase: (token, value) => {
            set((state) => ({
                edits: {
                    ...state.edits,
                    [token]: nextTokensEdit(state.edits[token], { base: value }),
                },
            }));
            applyAll();
        },

        setSpread: (token, value) => {
            const context = tokenStore.getState().currentContext;
            set((state) => {
                const existing = state.edits[token];
                const fallbackBase = effectiveBase(token, existing, context);
                return {
                    edits: {
                        ...state.edits,
                        [token]: nextTokensEdit(existing, {
                            base:
                                existing?.kind === "tokens"
                                    ? (existing.base ?? fallbackBase)
                                    : fallbackBase,
                            spread: value,
                        }),
                    },
                };
            });
            applyAll();
        },

        setStepOverride: (token, step, value) => {
            set((state) => {
                const existing = state.edits[token];
                const overrides = existing?.kind === "tokens" ? (existing.overrides ?? {}) : {};
                return {
                    edits: {
                        ...state.edits,
                        [token]: nextTokensEdit(existing, {
                            overrides: { ...overrides, [step]: value },
                        }),
                    },
                };
            });
            applyAll();
        },

        clearStepOverride: (token, step) => {
            set((state) => {
                const existing = state.edits[token];
                if (existing?.kind !== "tokens" || !existing.overrides) return state;
                const { [step]: _removed, ...rest } = existing.overrides;
                const nextOverrides = Object.keys(rest).length > 0 ? rest : undefined;
                return {
                    edits: {
                        ...state.edits,
                        [token]: nextTokensEdit(existing, { overrides: nextOverrides }),
                    },
                };
            });
            applyAll();
        },

        updateScale: (token, updater) => {
            const meta = bindings[token];
            if (!meta || meta.kind !== "scale") return;
            const existing = scaleStore.getState().edits[token];
            const current =
                existing?.kind === "scale"
                    ? existing.scale
                    : selectOriginalScale(baseline.getState(), meta.parentPath);
            if (!current) return;
            const next = updater(current);
            set((state) => ({
                edits: { ...state.edits, [token]: { kind: "scale", scale: next } },
            }));
            applyAll();
        },

        setLinkEnabled: (token, enabled) => {
            set((state) => ({
                links: { ...state.links, [token]: { enabled } },
            }));
            applyAll();
        },

        clearEditField: (token, field) => {
            const meta = bindings[token];
            const existing = scaleStore.getState().edits[token];
            if (!meta || !existing) return;

            if (existing.kind === "tokens") {
                const next = { ...existing };
                if (field === "base") delete next.base;
                if (field === "spread") delete next.spread;

                const spent =
                    next.base === undefined &&
                    (next.spread === undefined || next.spread === DEFAULT_SPREAD) &&
                    next.overrides === undefined;

                set((state) => {
                    const edits = { ...state.edits };
                    if (spent) delete edits[token];
                    else edits[token] = next;
                    return { edits };
                });
            } else {
                const original = selectOriginalScale(baseline.getState(), meta.parentPath);
                if (!original) return;
                const scale = restoreScaleField(existing.scale, original, field);
                set((state) => ({ edits: { ...state.edits, [token]: { kind: "scale", scale } } }));
            }

            applyAll();
        },

        resetAll: () => {
            set(() => ({ edits: {}, links: {}, bases: { ...authoredBases } }));
            applyAll();
        },
    }));

    function applyAll() {
        const { edits, links, bases } = scaleStore.getState();
        const { resolved, currentContext } = tokenStore.getState();
        const next = applyScaleEdits(
            resolved,
            edits,
            links,
            bindings,
            linkBindings,
            baseline.getState(),
            getPathIndex(),
            currentContext,
            bases,
        );
        writeResolved(next);
    }

    const activate = (): (() => void) => {
        const unsubToken = tokenStore.subscribe((state, prev) => {
            if (state.currentContext !== prev.currentContext) applyAll();
        });
        const unsubBaseline = baseline.subscribe(() => {
            scaleStore.setState(() => ({ edits: {}, links: {} }));
        });
        return () => {
            unsubToken();
            unsubBaseline();
        };
    };

    return { store: scaleStore, activate };
}

function nextTokensEdit(
    existing: ScaleEdit | undefined,
    patch: {
        base?: number;
        spread?: number;
        overrides?: StepOverrides | undefined;
    },
): ScaleEdit {
    if (existing?.kind === "tokens") {
        return {
            kind: "tokens",
            base: patch.base ?? existing.base,
            spread: patch.spread ?? existing.spread,
            overrides: "overrides" in patch ? patch.overrides : existing.overrides,
        };
    }
    return {
        kind: "tokens",
        base: patch.base,
        spread: patch.spread ?? DEFAULT_SPREAD,
        overrides: patch.overrides,
    };
}

function collectBindings(
    panelSections: PanelSection[],
    snapshot: TokenSnapshot,
    ownership: PanelOwnership,
): {
    bindings: Record<string, ScaleBindingMeta>;
    linkBindings: Record<string, LinkBindingMeta>;
} {
    const bindings: Record<string, ScaleBindingMeta> = {};
    const linkBindings: Record<string, LinkBindingMeta> = {};

    for (const section of panelSections) {
        for (const binding of section.bindings) {
            if (binding.type === "scale") {
                bindings[binding.token] = buildScaleBindingMeta(binding, snapshot, ownership);
            } else if (binding.type === "link") {
                linkBindings[binding.token] = {
                    bindingToken: binding.token,
                    sourceBinding: binding.scalesWith,
                };
            }
        }
    }

    for (const token of Object.keys(linkBindings)) {
        const link = linkBindings[token];
        if (!link || !bindings[link.sourceBinding]) {
            delete linkBindings[token];
        }
    }

    return { bindings, linkBindings };
}

function buildScaleBindingMeta(
    binding: ScaleBinding,
    snapshot: TokenSnapshot,
    ownership: PanelOwnership,
): ScaleBindingMeta {
    const parentPath = stripTrailingGlob(binding.token);
    const onDiskScale = getScaleExtension(snapshot.trees, parentPath);
    return {
        binding,
        kind: onDiskScale ? "scale" : "tokens",
        parentPath,
        ownedPaths: ownership.ownedPaths.get(binding.token) ?? [],
        sourcePath: findSourcePath(snapshot, parentPath),
    };
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

export type { CapturedLinkedScale, CapturedScale } from "../tokens/scale-cascade";
