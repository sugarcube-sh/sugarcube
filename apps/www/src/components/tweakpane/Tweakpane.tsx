import { useState, useEffect } from "react";
import { ColorsSection } from "./sections/ColorsSection";
import { SurfacesSection } from "./sections/SurfacesSection";
import { TextSection } from "./sections/TextSection";
import { BordersSection } from "./sections/BordersSection";
import { ShapeSection } from "./sections/ShapeSection";
import { TypeSection } from "./sections/TypeSection";
import { toggleMode, getMode } from "./hooks/useCSSVariables";
import { type Palette, DEFAULT_FAMILY_PALETTES } from "./data/palettes";

type TweakpaneProps = {
  defaultMinimized?: boolean;
};

export function Tweakpane({ defaultMinimized = false }: TweakpaneProps) {
  const [minimized, setMinimized] = useState(defaultMinimized);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [basePalette, setBasePalette] = useState<Palette>(DEFAULT_FAMILY_PALETTES.neutral);

  // Sync mode state with document
  useEffect(() => {
    setMode(getMode());

    const handleModeChange = (e: CustomEvent<{ mode: string }>) => {
      setMode(e.detail.mode as "light" | "dark");
    };

    document.addEventListener("mode-change", handleModeChange as EventListener);
    return () => {
      document.removeEventListener("mode-change", handleModeChange as EventListener);
    };
  }, []);

  const handleModeToggle = () => {
    toggleMode();
  };

  const handleOpenStudio = () => {
    window.open("/__sugarcube", "_blank");
  };

  if (minimized) {
    return (
      <div className="tweakpane tweakpane-minimized">
        <div className="tweakpane-header">
          <span className="tweakpane-logo">◆</span>
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
              className="tweakpane-expand"
              onClick={() => setMinimized(false)}
              aria-label="Expand widget"
            >
              □
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tweakpane">
      <div className="tweakpane-header">
        <span className="tweakpane-logo">◆</span>
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
            className="tweakpane-minimize"
            onClick={() => setMinimized(true)}
            aria-label="Minimize widget"
          >
            ─
          </button>
          <button
            type="button"
            className="tweakpane-open-studio"
            onClick={handleOpenStudio}
            aria-label="Open full Studio"
          >
            □
          </button>
        </div>
      </div>

      <div className="tweakpane-body">
        <ColorsSection basePalette={basePalette} onBasePaletteChange={setBasePalette} />
        <SurfacesSection />
        <TextSection />
        <BordersSection />
        <ShapeSection />
        <TypeSection />
      </div>
    </div>
  );
}

export default Tweakpane;
