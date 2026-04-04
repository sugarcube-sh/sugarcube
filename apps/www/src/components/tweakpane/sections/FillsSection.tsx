import { useState } from "react";
import { ColorGrid, type ColorSelection, colorSelectionToCSSValue } from "../components/ColorGrid";
import { Section } from "../components/Section";
import { TokenFolder } from "../components/TokenFolder";
import { resetCSSVar, setCSSVar } from "../hooks/useCSSVariables";

const FILLS = [
    { token: "quiet", label: "quiet" },
    { token: "normal", label: "normal" },
    { token: "loud", label: "loud" },
];

export function FillsSection() {
    const [customColors, setCustomColors] = useState<Record<string, ColorSelection>>({});
    const [expandedToken, setExpandedToken] = useState<string | null>(null);

    const handleToggle = (token: string) => {
        setExpandedToken((prev) => (prev === token ? null : token));
    };

    const handleColorSelect = (token: string, selection: ColorSelection) => {
        setCustomColors((prev) => ({ ...prev, [token]: selection }));
        setCSSVar(`--color-fill-${token}`, colorSelectionToCSSValue(selection));
    };

    const handleReset = (token: string) => {
        setCustomColors((prev) => {
            const next = { ...prev };
            delete next[token];
            return next;
        });
        resetCSSVar(`--color-fill-${token}`);
        setExpandedToken(null);
    };

    return (
        <Section title="FILLS">
            {FILLS.map((fill) => (
                <TokenFolder
                    key={fill.token}
                    label={fill.label}
                    cssVar={`--color-fill-${fill.token}`}
                    expanded={expandedToken === fill.token}
                    onToggle={() => handleToggle(fill.token)}
                    isCustom={fill.token in customColors}
                    onReset={() => handleReset(fill.token)}
                >
                    <ColorGrid
                        currentValue={customColors[fill.token]}
                        onSelect={(selection) => handleColorSelect(fill.token, selection)}
                    />
                </TokenFolder>
            ))}
        </Section>
    );
}
