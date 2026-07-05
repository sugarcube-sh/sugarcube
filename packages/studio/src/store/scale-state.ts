import type {
    PanelSection,
    ResolvedTokens,
    ScaleBinding,
    ScaleExtension,
} from "@sugarcube-sh/core/client";
import { type StoreApi, createStore } from "zustand";
import type { PathIndexAccessor } from "../tokens/path-index";
import { getScaleExtension } from "../tokens/scale-extension";
import type { TokenSnapshot } from "../tokens/types";
import type { TokenStoreAPI } from "./create-token-store";
import { applyScaleEdits } from "./scale-apply";
import { DEFAULT_SPREAD, selectCapture } from "./scale-selectors";
import type {
    LinkBindingMeta,
    LinkEdit,
    ScaleBindingMeta,
    ScaleEdit,
    StepOverrides,
} from "./scale-types";

export type ScaleStateStore = {
    edits: Record<string, ScaleEdit>;
    links: Record<string, LinkEdit>;
    bindings: Record<string, ScaleBindingMeta>;
    linkBindings: Record<string, LinkBindingMeta>;

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

export function createScaleState(
    panelSections: PanelSection[],
    snapshot: TokenSnapshot,
    getPathIndex: PathIndexAccessor,
    tokenStore: TokenStoreAPI,
    baseline: StoreApi<TokenSnapshot>,
    onWrite?: ScaleWriteCallback,
): ScaleStateHandle {
    const writeResolved: ScaleWriteCallback =
        onWrite ?? ((resolved) => tokenStore.setState({ resolved }));

    const { bindings, linkBindings } = collectBindings(panelSections, snapshot);

    const effectiveBase = (token: string, edit: ScaleEdit | undefined, context: string): number => {
        if (edit?.kind === "tokens" && edit.base !== undefined) return edit.base;
        const meta = bindings[token];
        if (!meta) return 0;
        return (
            selectCapture(baseline.getState(), getPathIndex(), meta.binding, context)?.baseMax ?? 0
        );
    };

    const scaleStore = createStore<ScaleStateStore>((set) => ({
        edits: {},
        links: {},
        bindings,
        linkBindings,

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

        resetAll: () => {
            set(() => ({ edits: {}, links: {} }));
            applyAll();
        },
    }));

    function applyAll() {
        const { edits, links } = scaleStore.getState();
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
): {
    bindings: Record<string, ScaleBindingMeta>;
    linkBindings: Record<string, LinkBindingMeta>;
} {
    const bindings: Record<string, ScaleBindingMeta> = {};
    const linkBindings: Record<string, LinkBindingMeta> = {};

    for (const section of panelSections) {
        for (const binding of section.bindings) {
            if (binding.type === "scale") {
                const meta = buildScaleBindingMeta(binding, snapshot);
                if (meta.kind === "scale" || binding.base) {
                    bindings[binding.token] = meta;
                } else {
                    console.warn(
                        `[studio] scale binding "${binding.token}" has no \`base\` and no sh.sugarcube.scale recipe; direct-mode controls need an anchor step. Add \`base\` to the binding or author a scale recipe on the bound group.`,
                    );
                }
            } else if (binding.type === "scale-linked") {
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

function buildScaleBindingMeta(binding: ScaleBinding, snapshot: TokenSnapshot): ScaleBindingMeta {
    const parentPath = stripTrailingGlob(binding.token);
    const onDiskScale = getScaleExtension(snapshot.trees, parentPath);
    return {
        binding,
        kind: onDiskScale ? "scale" : "tokens",
        parentPath,
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
