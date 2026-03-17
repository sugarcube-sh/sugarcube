import type { SelectorStrategy } from "../types/pipelines.js";

/** Reverse domain namespace per DTCG spec recommendation */
const SUGARCUBE_NAMESPACE = "sh.sugarcube";

type SugarcubeModifierExtensions = {
    prefersColorScheme?: boolean;
};

export function getSugarcubeExtensions(
    extensions: Record<string, unknown> | undefined
): SugarcubeModifierExtensions | undefined {
    if (!extensions?.[SUGARCUBE_NAMESPACE]) return undefined;
    return extensions[SUGARCUBE_NAMESPACE] as SugarcubeModifierExtensions;
}

export function extractSelectorStrategy(
    extensions: Record<string, unknown> | undefined
): SelectorStrategy {
    const ext = getSugarcubeExtensions(extensions);
    if (ext?.prefersColorScheme === true) return "prefers-color-scheme";
    return "data-attribute";
}
