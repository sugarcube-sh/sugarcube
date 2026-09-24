import { useMemo } from "react";
import { useBaseline, useCurrentContext, usePathIndex, useTokenStore } from "../store/hooks";
import { type MeasureLookup, createMeasureLookup } from "../tokens/measures";

export function useMeasure(): MeasureLookup {
    const pathIndex = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const { trees } = useBaseline();
    useCurrentContext();

    return useMemo(
        () => createMeasureLookup(trees, resolved, pathIndex),
        [trees, resolved, pathIndex],
    );
}
