import { useState } from "react";
import { ColorGrid, type ColorSelection, colorSelectionToCSSValue } from "../components/ColorGrid";
import { Section } from "../components/Section";
import { TokenFolder } from "../components/TokenFolder";
import type { Palette } from "../data/palettes";
import { getDefaultColorSelection } from "../data/tokenDefaults";
import { resetCSSVar, setCSSVar } from "../hooks/useCSSVariables";

const TEXT_TOKENS = [
    { token: "normal", label: "normal" },
    { token: "quiet", label: "quiet" },
    { token: "link", label: "link" },
];

type TextSectionProps = {
    basePalette: Palette;
    mode: "light" | "dark";
};

export function TextSection({ basePalette, mode }: TextSectionProps) {
    const [customColors, setCustomColors] = useState<Record<string, ColorSelection>>({});
    const [expandedToken, setExpandedToken] = useState<string | null>(null);

    const handleToggle = (token: string) => {
        setExpandedToken((prev) => (prev === token ? null : token));
    };

    const handleColorSelect = (token: string, selection: ColorSelection) => {
        setCustomColors((prev) => ({ ...prev, [token]: selection }));
        setCSSVar(`--color-text-${token}`, colorSelectionToCSSValue(selection));
    };

    const handleReset = (token: string) => {
        setCustomColors((prev) => {
            const next = { ...prev };
            delete next[token];
            return next;
        });
        resetCSSVar(`--color-text-${token}`);
        setExpandedToken(null);
    };

    return (
        <Section title="TEXT">
            {TEXT_TOKENS.map((text) => (
                <TokenFolder
                    key={text.token}
                    label={text.label}
                    cssVar={`--color-text-${text.token}`}
                    expanded={expandedToken === text.token}
                    onToggle={() => handleToggle(text.token)}
                    isCustom={text.token in customColors}
                    onReset={() => handleReset(text.token)}
                >
                    <ColorGrid
                        currentValue={
                            customColors[text.token] ??
                            getDefaultColorSelection(`text-${text.token}`, basePalette, mode)
                        }
                        onSelect={(selection) => handleColorSelect(text.token, selection)}
                    />
                </TokenFolder>
            ))}
        </Section>
    );
}
