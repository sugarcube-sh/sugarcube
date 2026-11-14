/** Reverse domain namespace per DTCG spec recommendation */
export const SUGARCUBE_NAMESPACE = "sh.sugarcube";

type SugarcubeModifierExtensions = {
    /** @deprecated Use `variables.permutations` with `atRule`. */
    prefersColorScheme?: boolean;
};

export function getSugarcubeExtensions(
    extensions: Record<string, unknown> | undefined,
): SugarcubeModifierExtensions | undefined {
    if (!extensions?.[SUGARCUBE_NAMESPACE]) return undefined;
    return extensions[SUGARCUBE_NAMESPACE] as SugarcubeModifierExtensions;
}

/**
 * Checks if a modifier's extensions set `prefersColorScheme`.
 *
 * @param extensions - The modifier's `$extensions`, such as `{ "sh.sugarcube": { prefersColorScheme: true } }`.
 * @deprecated Use `variables.permutations` with `atRule`.
 */
export function usesPrefersColorScheme(extensions: Record<string, unknown> | undefined): boolean {
    const ext = getSugarcubeExtensions(extensions);
    return ext?.prefersColorScheme === true;
}
