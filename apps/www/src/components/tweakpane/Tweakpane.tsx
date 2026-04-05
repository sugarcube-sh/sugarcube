import { useEffect, useRef, useState } from "react";
import { Logo } from "./components/Logo";
import { DEFAULT_FAMILY_PALETTES, type Palette } from "./data/palettes";
import {
    getMode,
    switchAccentPalette,
    switchBasePalette,
    toggleMode,
} from "./hooks/useCSSVariables";
import { useDraggable } from "./hooks/useDraggable";
import { AccentSection } from "./sections/AccentSection";
import { BaseSection } from "./sections/BaseSection";
import { BordersSection } from "./sections/BordersSection";
import { ControlsSection } from "./sections/ControlsSection";
import { FillsSection } from "./sections/FillsSection";
import { OnFillsSection } from "./sections/OnFillsSection";
import { ScaleSection } from "./sections/ScaleSection";
import { ShapeSection } from "./sections/ShapeSection";
import { SurfacesSection } from "./sections/SurfacesSection";
import { TextSection } from "./sections/TextSection";
import { TypeSection } from "./sections/TypeSection";

export function Tweakpane() {
    const [visible, setVisible] = useState(false);
    const [mode, setMode] = useState<"light" | "dark">("light");
    const [basePalette, setBasePalette] = useState<Palette>(DEFAULT_FAMILY_PALETTES.neutral);
    const [accentPalette, setAccentPalette] = useState<Palette>(DEFAULT_FAMILY_PALETTES.accent);
    const { position, dragHandleProps } = useDraggable({ x: 16, y: 16 });
    const launcherRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const lastFocusedRef = useRef<HTMLElement | null>(null);

    // Restore focus when tweakpane reopens
    useEffect(() => {
        if (visible) {
            requestAnimationFrame(() => {
                // Try restoring last focused element
                if (lastFocusedRef.current && panelRef.current?.contains(lastFocusedRef.current)) {
                    lastFocusedRef.current.focus();
                    return;
                }
                // Fall back to selected base swatch or first focusable
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

    // Sync mode state with document and re-apply palettes on mode change
    useEffect(() => {
        setMode(getMode());

        const handleModeChange = (e: CustomEvent<{ mode: string }>) => {
            const newMode = e.detail.mode as "light" | "dark";
            setMode(newMode);
            // Re-apply palette selections with new mode's scale mappings
            // Use setTimeout to ensure data-mode is set before we read it
            setTimeout(() => {
                switchBasePalette(basePalette);
                switchAccentPalette(accentPalette);
            }, 0);
        };

        document.addEventListener("mode-change", handleModeChange as EventListener);
        return () => {
            document.removeEventListener("mode-change", handleModeChange as EventListener);
        };
    }, [basePalette, accentPalette]);

    const handleModeToggle = () => {
        toggleMode();
    };

    const handleOpenStudio = () => {
        window.open("/__sugarcube", "_blank");
    };

    return (
        <>
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
                    <BaseSection basePalette={basePalette} onBasePaletteChange={setBasePalette} />
                    <AccentSection
                        accentPalette={accentPalette}
                        onAccentPaletteChange={setAccentPalette}
                    />
                    <SurfacesSection basePalette={basePalette} mode={mode} />
                    <TextSection basePalette={basePalette} mode={mode} />
                    <FillsSection basePalette={basePalette} mode={mode} />
                    <OnFillsSection basePalette={basePalette} mode={mode} />
                    <BordersSection basePalette={basePalette} mode={mode} />
                    <ShapeSection />
                    <ScaleSection />
                    <TypeSection />
                    <ControlsSection />
                </div>
            </div>
        </>
    );
}

export default Tweakpane;
