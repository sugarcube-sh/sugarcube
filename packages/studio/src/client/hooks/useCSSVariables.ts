/**
 * Thin helpers over the document's inline styles, for reading and
 * toggling presentation state that isn't tokenized.
 *
 * Most of the tweakpane's state flows through the token store, which
 * runs the sugarcube pipeline and injects the resulting CSS. A small
 * amount of UI state lives outside that pipeline:
 *
 *   - `getCSSVar` — reads a computed CSS var from :root, used by the
 *     palette swatch previews to match whatever color the pipeline
 *     actually emitted for the current step.
 *   - `toggleMode` — fires a `mode-change` event that the ThemeProvider
 *     listens to. Mode isn't a token (it determines which permutation's
 *     CSS is active), so it lives outside the token store.
 */

/**
 * Read a CSS variable's current computed value from :root.
 */
export function getCSSVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Toggle light/dark mode by dispatching a `mode-change` event. The
 * page's ThemeProvider handles the actual attribute swap.
 */
export function toggleMode(): void {
    const currentMode = document.documentElement.getAttribute("data-mode");
    const newMode = currentMode === "dark" ? "light" : "dark";

    document.dispatchEvent(
        new CustomEvent("mode-change", {
            detail: { mode: newMode },
        })
    );
}
