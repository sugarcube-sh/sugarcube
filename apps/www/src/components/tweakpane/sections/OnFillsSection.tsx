import { useState } from "react";
import { ColorGrid, type ColorSelection, colorSelectionToCSSValue } from "../components/ColorGrid";
import { Section } from "../components/Section";
import { TokenFolder } from "../components/TokenFolder";
import type { Palette } from "../data/palettes";
import { getDefaultColorSelection } from "../data/tokenDefaults";
import { resetCSSVar, setCSSVar } from "../hooks/useCSSVariables";

const ON_FILLS = [
    { token: "quiet", label: "quiet" },
    { token: "normal", label: "normal" },
    { token: "loud", label: "loud" },
];

type OnFillsSectionProps = {
    basePalette: Palette;
    mode: "light" | "dark";
};

export function OnFillsSection({ basePalette, mode }: OnFillsSectionProps) {
    const [customColors, setCustomColors] = useState<Record<string, ColorSelection>>({});
    const [expandedToken, setExpandedToken] = useState<string | null>(null);

    const handleToggle = (token: string) => {
        setExpandedToken((prev) => (prev === token ? null : token));
    };

    const handleColorSelect = (token: string, selection: ColorSelection) => {
        setCustomColors((prev) => ({ ...prev, [token]: selection }));
        setCSSVar(`--color-on-${token}`, colorSelectionToCSSValue(selection));
    };

    const handleReset = (token: string) => {
        setCustomColors((prev) => {
            const next = { ...prev };
            delete next[token];
            return next;
        });
        resetCSSVar(`--color-on-${token}`);
        setExpandedToken(null);
    };

    return (
        <Section title="ON-FILLS">
            {ON_FILLS.map((on) => (
                <TokenFolder
                    key={on.token}
                    label={on.label}
                    cssVar={`--color-on-${on.token}`}
                    expanded={expandedToken === on.token}
                    onToggle={() => handleToggle(on.token)}
                    isCustom={on.token in customColors}
                    onReset={() => handleReset(on.token)}
                >
                    <ColorGrid
                        currentValue={
                            customColors[on.token] ??
                            getDefaultColorSelection(`on-${on.token}`, basePalette, mode)
                        }
                        onSelect={(selection) => handleColorSelect(on.token, selection)}
                    />
                </TokenFolder>
            ))}
        </Section>
    );
}
