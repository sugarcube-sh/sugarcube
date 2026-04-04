import { useState } from "react";
import { ColorGrid, type ColorSelection, colorSelectionToCSSValue } from "../components/ColorGrid";
import { Section } from "../components/Section";
import { TokenFolder } from "../components/TokenFolder";
import { resetCSSVar, setCSSVar } from "../hooks/useCSSVariables";

const BORDER_COLORS = [
    { token: "quiet", label: "quiet" },
    { token: "normal", label: "normal" },
    { token: "loud", label: "loud" },
];

export function BorderColorsSection() {
    const [customColors, setCustomColors] = useState<Record<string, ColorSelection>>({});
    const [expandedToken, setExpandedToken] = useState<string | null>(null);

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
        <Section title="BORDER COLORS">
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
                        currentValue={customColors[border.token]}
                        onSelect={(selection) => handleColorSelect(border.token, selection)}
                    />
                </TokenFolder>
            ))}
        </Section>
    );
}
