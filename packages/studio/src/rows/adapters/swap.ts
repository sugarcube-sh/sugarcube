import { useBaseline, usePathIndex, useTokenStore, useTokenStoreApi } from "../../store/hooks";
import { currentSwapGroup, swapUpdates } from "../../tokens/swap";
import type { Adapter } from "../types";

export const swapAdapter =
    (family: string, baselineGroup: string): Adapter<string> =>
    () => {
        const tokenStore = useTokenStoreApi();
        const pathIndex = usePathIndex();
        const setTokens = useTokenStore((state) => state.setTokens);
        const resolved = useTokenStore((state) => state.resolved);
        const baseline = useBaseline();

        const contexts = pathIndex.contexts;
        const readCurrent = (path: string, context?: string) =>
            pathIndex.readValue(resolved, path, context);
        const readBaseline = (path: string, context?: string) =>
            pathIndex.readValue(baseline.resolved, path, context);

        const current = currentSwapGroup(
            family,
            baselineGroup,
            readCurrent,
            readBaseline,
            pathIndex,
            contexts,
        );

        function swapTo(next: string) {
            const read = tokenStore.getState().getToken;
            setTokens(
                swapUpdates(family, baselineGroup, next, read, readBaseline, pathIndex, contexts),
            );
        }

        const overridden = current !== undefined && current !== baselineGroup;

        return {
            value: current,
            set: swapTo,
            commit: swapTo,
            overridden,
            reset: overridden ? () => swapTo(baselineGroup) : undefined,
        };
    };
