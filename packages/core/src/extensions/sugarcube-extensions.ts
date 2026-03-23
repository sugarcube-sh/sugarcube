/** Reverse domain namespace per DTCG spec recommendation */
const SUGARCUBE_NAMESPACE = "sh.sugarcube";

type SugarcubeModifierExtensions = {
    /** @deprecated Use atRule: "@media (prefers-color-scheme: {context})" instead */
    prefersColorScheme?: boolean;
    /** Selector pattern, e.g. "[data-theme=\"{context}\"]" or ".theme-{context}" */
    selector?: string;
    /** At-rule pattern, e.g. "@media (prefers-color-scheme: {context})" */
    atRule?: string;
};

export function getSugarcubeExtensions(
    extensions: Record<string, unknown> | undefined
): SugarcubeModifierExtensions | undefined {
    if (!extensions?.[SUGARCUBE_NAMESPACE]) return undefined;
    return extensions[SUGARCUBE_NAMESPACE] as SugarcubeModifierExtensions;
}

/**
 * Extract the selector pattern from extensions.
 * Returns undefined if no selector is configured.
 */
export function getSelector(extensions: Record<string, unknown> | undefined): string | undefined {
    const ext = getSugarcubeExtensions(extensions);
    return ext?.selector;
}

/**
 * Extract the at-rule pattern from extensions.
 * Handles backwards compatibility with prefersColorScheme.
 * Returns undefined if no at-rule is configured.
 */
export function getAtRule(extensions: Record<string, unknown> | undefined): string | undefined {
    const ext = getSugarcubeExtensions(extensions);
    // Handle backwards compatibility: prefersColorScheme: true → atRule pattern
    if (ext?.prefersColorScheme === true) {
        return "@media (prefers-color-scheme: {context})";
    }
    return ext?.atRule;
}

/**
 * Check if the modifier uses prefersColorScheme (for validation purposes).
 */
export function usesPrefersColorScheme(extensions: Record<string, unknown> | undefined): boolean {
    const ext = getSugarcubeExtensions(extensions);
    return ext?.prefersColorScheme === true;
}
