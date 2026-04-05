import { useState } from "react";
import { Section } from "../components/Section";
import { FORM_CONTROL_SIZES, type FormControlSize } from "../data/palettes";
import { setFormControlFontSize } from "../hooks/useCSSVariables";

export function ControlsSection() {
    const [controlSize, setControlSize] = useState<FormControlSize>("sm");

    const handleControlSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const size = FORM_CONTROL_SIZES[Number(e.target.value)];
        if (!size) return;
        setControlSize(size);
        setFormControlFontSize(size);
    };

    return (
        <Section title="CONTROLS">
            <div className="tweakpane-slider-row">
                <span className="tweakpane-slider-label">size</span>
                <input
                    type="range"
                    className="tweakpane-slider"
                    min={0}
                    max={FORM_CONTROL_SIZES.length - 1}
                    step={1}
                    value={FORM_CONTROL_SIZES.indexOf(controlSize)}
                    onChange={handleControlSizeChange}
                    aria-label="Form control size"
                    aria-valuetext={controlSize}
                />
                <span className="tweakpane-slider-value">{controlSize}</span>
            </div>
        </Section>
    );
}
