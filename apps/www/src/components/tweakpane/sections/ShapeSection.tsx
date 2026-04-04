import { useState } from "react";
import { CornerPresets } from "../components/CornerPresets";
import { Section } from "../components/Section";
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
        <Section title="CORNERS">
            <div className="tweakpane-corners-row">
                <span className="tweakpane-corners-label">containers</span>
                <CornerPresets value={containerCorners} onChange={handleContainerChange} />
            </div>
            <div className="tweakpane-corners-row">
                <span className="tweakpane-corners-label">controls</span>
                <CornerPresets value={controlCorners} onChange={handleControlChange} />
            </div>
        </Section>
    );
}
