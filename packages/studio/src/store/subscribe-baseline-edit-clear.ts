import type { StoreApi } from "zustand";
import type { TokenSnapshot } from "../tokens/types";

/**
 * Subscribe to baseline changes and run a callback that should clear
 * any pending user edits. Used by both recipe-state and scale-state to
 * preserve today's "external write wins" semantics: when disk changes
 * (file watcher, save, discard, external editor edit), in-flight SPA
 * edits are blown away to match.
 *
 * Returns the unsubscribe function. Today the stores live for the
 * session and never tear down, so the caller can ignore it.
 */
export function subscribeBaselineEditClear(
    baseline: StoreApi<TokenSnapshot>,
    clearEdits: () => void
): () => void {
    return baseline.subscribe(clearEdits);
}
