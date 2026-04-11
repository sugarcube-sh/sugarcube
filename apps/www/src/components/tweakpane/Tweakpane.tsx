import { useEffect, useRef, useState } from "react";
import { Logo } from "./components/Logo";
import { PanelSectionView } from "./controls/PanelSectionView";
import { PANEL_CONFIG } from "./data/panel-config";
import { toggleMode } from "./hooks/useCSSVariables";
import { useDraggable } from "./hooks/useDraggable";
import { useMode } from "./hooks/useMode";
import { DiffSection } from "./sections/DiffSection";
import { TokenStorePipelineRunner } from "./store/TokenStore";

/**
 * The Tweakpane is now fully config-driven. It iterates the panel
 * sections from `data/panel-config.ts` and renders each through the
 * generic `PanelSectionView`, which dispatches bindings to the right
 * control component via the resolver.
 *
 * The only non-config-driven piece is `DiffSection`, which is a
 * computed view of what's changed — not an editable control — so it
 * lives outside the panel config and is always rendered at the bottom.
 */
export function Tweakpane() {
    const [visible, setVisible] = useState(false);
    const mode = useMode();
    const { position, dragHandleProps } = useDraggable({ x: 16, y: 16 });
    const launcherRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const lastFocusedRef = useRef<HTMLElement | null>(null);

    // Restore focus when tweakpane reopens
    useEffect(() => {
        if (visible) {
            requestAnimationFrame(() => {
                if (lastFocusedRef.current && panelRef.current?.contains(lastFocusedRef.current)) {
                    lastFocusedRef.current.focus();
                    return;
                }
                const panel = panelRef.current;
                if (!panel) return;
                const swatch = panel.querySelector<HTMLElement>(
                    '[role="radio"][aria-checked="true"]'
                );
                if (swatch) {
                    swatch.focus();
                } else {
                    const first = panel.querySelector<HTMLElement>(
                        'button, input, select, [tabindex="0"]'
                    );
                    first?.focus();
                }
            });
        }
    }, [visible]);

    const handleModeToggle = () => {
        toggleMode();
    };

    const ctx = { colorScale: PANEL_CONFIG.colorScale };
    const sections = PANEL_CONFIG.panel ?? [];

    return (
        <>
            <TokenStorePipelineRunner />
            <button
                ref={launcherRef}
                type="button"
                className="tweakpane-launcher"
                onClick={() => setVisible(true)}
                aria-label="Open Sugarcube tweakpane"
                hidden={visible}
            >
                <Logo size={20} />
            </button>

            <div
                ref={panelRef}
                className="tweakpane"
                style={{ left: position.x, top: position.y }}
                hidden={!visible}
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        lastFocusedRef.current = document.activeElement as HTMLElement;
                        setVisible(false);
                        requestAnimationFrame(() => launcherRef.current?.focus());
                    }
                }}
            >
                <div className="tweakpane-header" {...dragHandleProps}>
                    <span className="tweakpane-logo">
                        <Logo size={14} />
                    </span>
                    <span className="tweakpane-title">Sugarcube</span>
                    <div className="tweakpane-header-actions">
                        <button
                            type="button"
                            className="tweakpane-mode-toggle"
                            onClick={handleModeToggle}
                            aria-label={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
                        >
                            <span data-active={mode === "light"}>◐</span>
                            <span data-active={mode === "dark"}>○</span>
                        </button>
                        <button
                            type="button"
                            className="tweakpane-close"
                            onClick={() => {
                                lastFocusedRef.current = document.activeElement as HTMLElement;
                                setVisible(false);
                                requestAnimationFrame(() => launcherRef.current?.focus());
                            }}
                            aria-label="Close tweakpane"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="tweakpane-body">
                    {sections.map((section, i) => (
                        <PanelSectionView
                            key={`${section.title}-${i}`}
                            section={section}
                            ctx={ctx}
                            defaultExpanded={i === 0}
                        />
                    ))}
                    <DiffSection />
                </div>
            </div>
        </>
    );
}

export default Tweakpane;
