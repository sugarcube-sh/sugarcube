import { useCallback } from "react";
import { useCurrentContext, usePathIndex, useTokenStore } from "../store/hooks";
import type { ReadValue } from "../tokens/dimension";

export function useReadValue(): ReadValue {
    const pathIndex = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const context = useCurrentContext();

    return useCallback(
        (path: string) => pathIndex.readValue(resolved, path, context),
        [pathIndex, resolved, context],
    );
}
