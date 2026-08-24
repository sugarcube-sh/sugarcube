import { useMemo } from "react";
import {
    useBaseline,
    useCurrentContext,
    useFamilyPalette,
    usePathIndex,
    useTokenStore,
    useTokenStoreApi,
} from "../../store/hooks";
import { familyPaletteResetUpdates, familyPaletteSwapUpdates } from "../../tokens/palette";
import type { Adapter } from "../types";

/**
 * Swapping a family's palette is currently the one write in the adapter layer that touches many
 * tokens at once: familyPaletteSwapUpdates walks every token under the family, finds the
 * ones pointing at the old palette, and repoints them. It goes through setTokens as a single
 * batch so the pipeline re-runs once rather than once per token.
 */
export const paletteSwapAdapter =
    (family: string, palettes: readonly string[]): Adapter<string> =>
    () => {
        const tokenStore = useTokenStoreApi();
        const pathIndex = usePathIndex();
        const setTokens = useTokenStore((state) => state.setTokens);
        const current = useFamilyPalette(family, palettes);
        const baseline = useBaseline();
        const context = useCurrentContext();
        const resolved = useTokenStore((state) => state.resolved);

        function swap(next: string) {
            const readToken = tokenStore.getState().getToken;
            setTokens(familyPaletteSwapUpdates(family, next, palettes, readToken, pathIndex));
        }

        const plan = useMemo(
            () =>
                familyPaletteResetUpdates(
                    family,
                    palettes,
                    (path, ctx) => pathIndex.readValue(resolved, path, ctx),
                    (path, ctx) => pathIndex.readValue(baseline.resolved, path, ctx),
                    pathIndex,
                    context,
                ),
            [resolved, baseline, pathIndex, context],
        );

        return {
            overridden: plan.overridden,
            reset: plan.overridden ? () => setTokens(plan.updates) : undefined,
            value: current,
            set: swap,
            commit: swap,
        };
    };
