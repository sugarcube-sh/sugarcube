/** Reverse domain namespace per DTCG spec recommendation */
const SUGARCUBE_NAMESPACE = "sh.sugarcube";

type SugarcubeModifierExtensions = {
    /** @deprecated Use variables.permutations with atRule instead */
    prefersColorScheme?: boolean;
};

export function getSugarcubeExtensions(
    extensions: Record<string, unknown> | undefined
): SugarcubeModifierExtensions | undefined {
    if (!extensions?.[SUGARCUBE_NAMESPACE]) return undefined;
    return extensions[SUGARCUBE_NAMESPACE] as SugarcubeModifierExtensions;
}

/**
 * Check if the modifier uses prefersColorScheme (for validation purposes).
 * @deprecated Use variables.permutations with atRule instead
 */
export function usesPrefersColorScheme(extensions: Record<string, unknown> | undefined): boolean {
    const ext = getSugarcubeExtensions(extensions);
    return ext?.prefersColorScheme === true;
}
