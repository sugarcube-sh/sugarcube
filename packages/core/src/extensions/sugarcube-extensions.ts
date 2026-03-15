import type { SelectorStrategy } from "../types/pipelines.js";

/** Reverse domain namespace per DTCG spec recommendation */
const SUGARCUBE_NAMESPACE = "sh.sugarcube";

type SugarcubeExtensions = {
    selector?: SelectorStrategy;
};

export function getSugarcubeExtensions(
    extensions: Record<string, unknown> | undefined
): SugarcubeExtensions | undefined {
    if (!extensions?.[SUGARCUBE_NAMESPACE]) return undefined;
    return extensions[SUGARCUBE_NAMESPACE] as SugarcubeExtensions;
}

export function extractSelectorStrategy(
    extensions: Record<string, unknown> | undefined
): SelectorStrategy {
    const ext = getSugarcubeExtensions(extensions);
    if (ext?.selector === "prefers-color-scheme") return "prefers-color-scheme";
    return "data-attribute";
}
