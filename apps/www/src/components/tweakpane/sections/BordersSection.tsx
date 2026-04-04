import { useState } from "react";
import { Section } from "../components/Section";
import { BORDER_WIDTH_PRESETS, type BorderWidthPreset } from "../data/palettes";
import { setBorderWidth } from "../hooks/useCSSVariables";

const PRESETS: BorderWidthPreset[] = ["hairline", "thin", "thick"];

export function BordersSection() {
    const [width, setWidth] = useState<BorderWidthPreset>("thin");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const preset = PRESETS[Number(e.target.value)];
        setWidth(preset);
        setBorderWidth(BORDER_WIDTH_PRESETS[preset]);
    };

    return (
        <Section title="BORDERS">
            <div className="tweakpane-slider-row">
                <span className="tweakpane-slider-label">width</span>
                <input
                    type="range"
                    className="tweakpane-slider"
                    min={0}
                    max={PRESETS.length - 1}
                    step={1}
                    value={PRESETS.indexOf(width)}
                    onChange={handleChange}
                    aria-label="Border width"
                    aria-valuetext={width}
                />
                <span className="tweakpane-slider-value">{width}</span>
            </div>
        </Section>
    );
}
