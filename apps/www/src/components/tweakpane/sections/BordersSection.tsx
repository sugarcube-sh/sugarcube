import { useState } from "react";
import { ColorGrid, type ColorSelection, colorSelectionToCSSValue } from "../components/ColorGrid";
import { Section } from "../components/Section";
import { TokenFolder } from "../components/TokenFolder";
import { BORDER_WIDTH_PRESETS, type BorderWidthPreset, type Palette } from "../data/palettes";
import { getDefaultColorSelection } from "../data/tokenDefaults";
import { resetCSSVar, setBorderWidth, setCSSVar } from "../hooks/useCSSVariables";

const BORDER_COLORS = [
    { token: "quiet", label: "quiet" },
    { token: "normal", label: "normal" },
    { token: "loud", label: "loud" },
];

const WIDTH_PRESETS: BorderWidthPreset[] = ["hairline", "thin", "thick"];

type BordersSectionProps = {
    basePalette: Palette;
    mode: "light" | "dark";
};

export function BordersSection({ basePalette, mode }: BordersSectionProps) {
    const [width, setWidth] = useState<BorderWidthPreset>("thin");
    const [customColors, setCustomColors] = useState<Record<string, ColorSelection>>({});
    const [expandedToken, setExpandedToken] = useState<string | null>(null);

    const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const preset = WIDTH_PRESETS[Number(e.target.value)];
        setWidth(preset);
        setBorderWidth(BORDER_WIDTH_PRESETS[preset]);
    };

    const handleToggle = (token: string) => {
        setExpandedToken((prev) => (prev === token ? null : token));
    };

    const handleColorSelect = (token: string, selection: ColorSelection) => {
        setCustomColors((prev) => ({ ...prev, [token]: selection }));
        setCSSVar(`--color-border-${token}`, colorSelectionToCSSValue(selection));
    };

    const handleReset = (token: string) => {
        setCustomColors((prev) => {
            const next = { ...prev };
            delete next[token];
            return next;
        });
        resetCSSVar(`--color-border-${token}`);
        setExpandedToken(null);
    };

    return (
        <Section title="BORDERS">
            <div className="tweakpane-slider-row">
                <span className="tweakpane-slider-label">width</span>
                <input
                    type="range"
                    className="tweakpane-slider"
                    min={0}
                    max={WIDTH_PRESETS.length - 1}
                    step={1}
                    value={WIDTH_PRESETS.indexOf(width)}
                    onChange={handleWidthChange}
                    aria-label="Border width"
                    aria-valuetext={width}
                />
                <span className="tweakpane-slider-value">{width}</span>
            </div>
            {BORDER_COLORS.map((border) => (
                <TokenFolder
                    key={border.token}
                    label={border.label}
                    cssVar={`--color-border-${border.token}`}
                    expanded={expandedToken === border.token}
                    onToggle={() => handleToggle(border.token)}
                    isCustom={border.token in customColors}
                    onReset={() => handleReset(border.token)}
                >
                    <ColorGrid
                        currentValue={
                            customColors[border.token] ??
                            getDefaultColorSelection(`border-${border.token}`, basePalette, mode)
                        }
                        onSelect={(selection) => handleColorSelect(border.token, selection)}
                    />
                </TokenFolder>
            ))}
        </Section>
    );
}
