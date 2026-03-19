import { useState } from "react";
import { Section } from "../components/Section";
import { BorderWidthPresets } from "../components/BorderWidthPresets";
import { BORDER_WIDTH_PRESETS, type BorderWidthPreset } from "../data/palettes";
import { setBorderWidth } from "../hooks/useCSSVariables";

export function BordersSection() {
  const [width, setWidth] = useState<BorderWidthPreset>("thin");

  const handleWidthChange = (preset: BorderWidthPreset) => {
    setWidth(preset);
    setBorderWidth(BORDER_WIDTH_PRESETS[preset]);
  };

  return (
    <Section title="BORDERS">
      <div className="tweakpane-borders-row">
        <span className="tweakpane-borders-label">Width</span>
        <BorderWidthPresets value={width} onChange={handleWidthChange} />
      </div>
    </Section>
  );
}
