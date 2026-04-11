import { useSyncExternalStore } from "react";

export type Mode = "light" | "dark";

/**
 * Read the current mode from the document's `data-mode` attribute.
 * Defaults to `"light"` if the attribute isn't set or we're outside a
 * browser context (SSR).
 */
function getModeFromDocument(): Mode {
    if (typeof document === "undefined") return "light";
    const attr = document.documentElement.getAttribute("data-mode");
    return attr === "dark" ? "dark" : "light";
}

/**
 * Server-rendered snapshot. We default to `"light"` on the server
 * because the document attribute isn't available there.
 */
function getServerSnapshot(): Mode {
    return "light";
}

/**
 * Subscribe to the `mode-change` custom event that the page's theme
 * toggle fires. Module-level so the same function reference is passed
 * to `useSyncExternalStore` on every render — React uses reference
 * identity to decide whether to re-subscribe.
 */
function subscribe(callback: () => void): () => void {
    document.addEventListener("mode-change", callback);
    return () => {
        document.removeEventListener("mode-change", callback);
    };
}

/**
 * Subscribe to the current display mode (light/dark) of the document.
 *
 * Mode is not stored in the token store because it isn't a token — it's
 * a UI state that determines which CSS selector applies. The page's mode
 * toggle dispatches a `mode-change` custom event which this hook listens
 * for via `useSyncExternalStore`.
 *
 * `useSyncExternalStore` is the right primitive for subscribing to an
 * external system like a DOM event: it handles the subscribe/unsubscribe
 * lifecycle, reads the current value on every render, and avoids the
 * "tearing" problem that naive `useEffect` + `useState` subscriptions
 * have under concurrent rendering.
 */
export function useMode(): Mode {
    return useSyncExternalStore(subscribe, getModeFromDocument, getServerSnapshot);
}
