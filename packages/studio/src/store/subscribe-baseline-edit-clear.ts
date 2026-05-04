import type { StoreApi } from "zustand";
import type { TokenSnapshot } from "../tokens/types";

export function subscribeBaselineEditClear(
    baseline: StoreApi<TokenSnapshot>,
    clearEdits: () => void
): () => void {
    return baseline.subscribe(clearEdits);
}
