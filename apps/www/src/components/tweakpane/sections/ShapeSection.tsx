import { useState } from "react";
import { Section } from "../components/Section";
import { CornerPresets } from "../components/CornerPresets";
import { CORNER_PRESETS, type CornerPreset } from "../data/palettes";
import { setContainerRadius, setControlRadius } from "../hooks/useCSSVariables";

export function ShapeSection() {
  const [containerCorners, setContainerCorners] = useState<CornerPreset>("rounded");
  const [controlCorners, setControlCorners] = useState<CornerPreset>("rounded");

  const handleContainerChange = (preset: CornerPreset) => {
    setContainerCorners(preset);
    setContainerRadius(CORNER_PRESETS[preset]);
  };

  const handleControlChange = (preset: CornerPreset) => {
    setControlCorners(preset);
    setControlRadius(CORNER_PRESETS[preset]);
  };

  return (
    <Section title="SHAPE">
      <div className="tweakpane-shape-row">
        <span className="tweakpane-shape-label">Containers</span>
        <CornerPresets value={containerCorners} onChange={handleContainerChange} />
      </div>
      <div className="tweakpane-shape-row">
        <span className="tweakpane-shape-label">Controls</span>
        <CornerPresets value={controlCorners} onChange={handleControlChange} />
      </div>
    </Section>
  );
}
