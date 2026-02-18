/**
 * Tooltip utilities
 * Hides tooltip immediately on click, restores on mouseleave
 */
export function initTooltipClickHide() {
    document.addEventListener("click", (e) => {
        const target = (e.target as HTMLElement).closest("[data-tooltip]");
        if (!target) return;

        target.setAttribute("data-tooltip-hidden", "");

        target.addEventListener(
            "mouseleave",
            () => {
                target.removeAttribute("data-tooltip-hidden");
            },
            { once: true }
        );
    });
}
