import { useState } from "react";
import { Section } from "../components/Section";
import { PaletteSwatches } from "../components/PaletteSwatches";
import {
  ALL_PALETTES,
  DEFAULT_FAMILY_PALETTES,
  STATUS_FAMILIES,
  type Palette,
  type StatusFamily,
} from "../data/palettes";
import {
  switchBasePalette,
  switchAccentPalette,
  switchStatusPalette,
} from "../hooks/useCSSVariables";

type ColorsSectionProps = {
  basePalette: Palette;
  onBasePaletteChange: (palette: Palette) => void;
};

export function ColorsSection({ basePalette, onBasePaletteChange }: ColorsSectionProps) {
  const [accentPalette, setAccentPalette] = useState<Palette>(DEFAULT_FAMILY_PALETTES.accent);
  const [statusPalettes, setStatusPalettes] = useState<Record<StatusFamily, Palette>>({
    success: DEFAULT_FAMILY_PALETTES.success,
    warning: DEFAULT_FAMILY_PALETTES.warning,
    error: DEFAULT_FAMILY_PALETTES.error,
    info: DEFAULT_FAMILY_PALETTES.info,
  });
  const [showStatus, setShowStatus] = useState(false);

  const handleBaseChange = (palette: Palette) => {
    onBasePaletteChange(palette);
    switchBasePalette(palette);
  };

  const handleAccentChange = (palette: Palette) => {
    setAccentPalette(palette);
    switchAccentPalette(palette);
  };

  const handleStatusChange = (status: StatusFamily, palette: Palette) => {
    setStatusPalettes((prev) => ({ ...prev, [status]: palette }));
    switchStatusPalette(status, palette);
  };

  return (
    <Section title="COLORS">
      <PaletteSwatches
        label="Base"
        value={basePalette}
        onChange={handleBaseChange}
        palettes={ALL_PALETTES}
      />

      <PaletteSwatches
        label="Accent"
        value={accentPalette}
        onChange={handleAccentChange}
        palettes={ALL_PALETTES}
      />

      <div className="tweakpane-subsection">
        <button
          type="button"
          className="tweakpane-subsection-toggle"
          onClick={() => setShowStatus(!showStatus)}
          aria-expanded={showStatus}
        >
          <span>{showStatus ? "▼" : "▶"}</span>
          <span>Status colors</span>
        </button>

        {showStatus && (
          <div className="tweakpane-subsection-content">
            {STATUS_FAMILIES.map((status) => (
              <PaletteSwatches
                key={status}
                label={status.charAt(0).toUpperCase() + status.slice(1)}
                value={statusPalettes[status]}
                onChange={(palette) => handleStatusChange(status, palette)}
                palettes={ALL_PALETTES}
              />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
