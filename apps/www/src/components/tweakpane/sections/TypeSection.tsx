import { useState } from "react";
import { Section } from "../components/Section";
import { FONTS, FORM_CONTROL_SIZES, type FontFamily, type FormControlSize } from "../data/palettes";
import { setFontFamily, setFormControlFontSize } from "../hooks/useCSSVariables";

export function TypeSection() {
    const [bodyFont, setBodyFont] = useState<FontFamily>("sans");
    const [headingFont, setHeadingFont] = useState<FontFamily>("sans");
    const [controlSize, setControlSize] = useState<FormControlSize>("sm");

    const handleBodyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const font = e.target.value as FontFamily;
        setBodyFont(font);
        setFontFamily("body", font);
    };

    const handleHeadingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const font = e.target.value as FontFamily;
        setHeadingFont(font);
        setFontFamily("heading", font);
    };

    const handleControlSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const size = FORM_CONTROL_SIZES[Number(e.target.value)];
        if (!size) return;
        setControlSize(size);
        setFormControlFontSize(size);
    };

    const fontOptions = Object.entries(FONTS);

    return (
        <Section title="TYPE">
            <div className="tweakpane-type-row">
                <label className="tweakpane-type-label" htmlFor="tweakpane-body-font">
                    body
                </label>
                <select
                    id="tweakpane-body-font"
                    className="tweakpane-type-select"
                    value={bodyFont}
                    onChange={handleBodyChange}
                >
                    {fontOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="tweakpane-type-row">
                <label className="tweakpane-type-label" htmlFor="tweakpane-heading-font">
                    headings
                </label>
                <select
                    id="tweakpane-heading-font"
                    className="tweakpane-type-select"
                    value={headingFont}
                    onChange={handleHeadingChange}
                >
                    {fontOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="tweakpane-slider-row">
                <span className="tweakpane-slider-label">controls</span>
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
