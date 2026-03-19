import { useEffect, useState } from "react";
import { type Palette, ALL_PALETTES } from "../data/palettes";
import { getCSSVar } from "../hooks/useCSSVariables";

type PaletteSwatchesProps = {
  label: string;
  value: Palette;
  onChange: (palette: Palette) => void;
  /** Which palettes to show. Defaults to all. */
  palettes?: readonly Palette[];
  /** Which scale step to use for the swatch preview. Defaults to "500". */
  previewStep?: string;
};

export function PaletteSwatches({
  label,
  value,
  onChange,
  palettes = ALL_PALETTES,
  previewStep = "500",
}: PaletteSwatchesProps) {
  // Store computed colors for swatches
  const [colors, setColors] = useState<Record<string, string>>({});

  // Read computed colors on mount
  useEffect(() => {
    const computed: Record<string, string> = {};
    for (const palette of palettes) {
      computed[palette] = getCSSVar(`--color-${palette}-${previewStep}`);
    }
    setColors(computed);
  }, [palettes, previewStep]);

  return (
    <div className="tweakpane-palette-swatches">
      <span className="tweakpane-palette-label">{label}</span>
      <div className="tweakpane-palette-row" role="radiogroup" aria-label={label}>
        {palettes.map((palette) => (
          <button
            key={palette}
            type="button"
            role="radio"
            aria-checked={value === palette}
            aria-label={palette}
            className="tweakpane-swatch"
            data-palette={palette}
            data-selected={value === palette}
            style={{ backgroundColor: colors[palette] || undefined }}
            onClick={() => onChange(palette)}
          />
        ))}
      </div>
      <span className="tweakpane-palette-value">{value}</span>
    </div>
  );
}
