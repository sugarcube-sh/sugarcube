import { useCurrentContext, usePathIndex, useTokenStore } from "../store/hooks";
import { cssColorFor } from "../tokens/color-value";

/** A token's colour as CSS, resolved through any alias chain in the current context. */
export function useTokenColor(path: string): string | undefined {
    const pathIndex = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const context = useCurrentContext();
    return cssColorFor(path, (p) => pathIndex.readValue(resolved, p, context));
}
