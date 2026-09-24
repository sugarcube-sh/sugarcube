import { useSelectedPath } from "../pages/NodeRoute";
import type { Row } from "../rows/types";
import {
    useBaseline,
    useCurrentContext,
    usePathIndex,
    useScaleState,
    useTokenStore,
} from "../store/hooks";
import { rowsForGroup } from "./node-rows";

export function useGroupRows(path: string | undefined): Row[] {
    const pathIndex = usePathIndex();
    const context = useCurrentContext();
    const resolved = useTokenStore((state) => state.resolved);
    const baseline = useBaseline();
    const bases = useScaleState((state) => state.bases);

    if (!path) return [];

    // A token edits in place on the canvas, so it has no rows here.
    if (pathIndex.readToken(resolved, path, context)) return [];

    return rowsForGroup(path, {
        pathIndex,
        resolved,
        context,
        baseline,
        scaleBase: bases[`${path}.*`],
    });
}

/** The dock, which has no canvas to put the recipe on. */
export function useEditorRows(): Row[] {
    return useGroupRows(useSelectedPath());
}
