import type { Permutation } from "../../types/config.js";

const PERM_KEY = /^perm:(\d+)$/;

function isDefaultPermutation(perm: Permutation, defaults?: Record<string, string>): boolean {
    const input = Object.entries(perm.input ?? {});
    if (input.length === 0) return true;
    if (!defaults) return false;

    return input.every(([modifier, context]) => defaults[modifier] === context);
}

export function findDefaultContext(
    contextKeys: string[],
    permutations?: Permutation[],
    modifierDefaults?: Record<string, string>,
): string | undefined {
    const candidates = contextKeys.filter((id) => {
        const match = PERM_KEY.exec(id);
        const perm = match ? permutations?.[Number(match[1])] : undefined;
        return perm ? isDefaultPermutation(perm, modifierDefaults) : contextKeys.length === 1;
    });

    return candidates.length === 1 ? candidates[0] : undefined;
}
