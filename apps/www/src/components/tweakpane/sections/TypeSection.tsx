import { useState } from "react";
import { Section } from "../components/Section";
import { FONTS, type FontFamily } from "../data/palettes";
import { setFontFamily } from "../hooks/useCSSVariables";

export function TypeSection() {
  const [bodyFont, setBodyFont] = useState<FontFamily>("sans");
  const [headingFont, setHeadingFont] = useState<FontFamily>("sans");

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

  const fontOptions = Object.entries(FONTS);

  return (
    <Section title="TYPE">
      <div className="tweakpane-type-row">
        <label className="tweakpane-type-label" htmlFor="tweakpane-body-font">
          Body
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
          Headings
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
    </Section>
  );
}
