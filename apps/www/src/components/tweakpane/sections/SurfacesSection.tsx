import { useState } from "react";
import { ColorGrid, type ColorSelection, colorSelectionToCSSValue } from "../components/ColorGrid";
import { Section } from "../components/Section";
import { TokenFolder } from "../components/TokenFolder";
import type { Palette } from "../data/palettes";
import { getDefaultColorSelection } from "../data/tokenDefaults";
import { resetCSSVar, setCSSVar } from "../hooks/useCSSVariables";

const SURFACES = [
    { token: "default", label: "default" },
    { token: "raised", label: "raised" },
    { token: "lowered", label: "lowered" },
    { token: "lowest", label: "lowest" },
];

type SurfacesSectionProps = {
    basePalette: Palette;
    mode: "light" | "dark";
};

export function SurfacesSection({ basePalette, mode }: SurfacesSectionProps) {
    const [customColors, setCustomColors] = useState<Record<string, ColorSelection>>({});
    const [expandedToken, setExpandedToken] = useState<string | null>(null);

    const handleToggle = (token: string) => {
        setExpandedToken((prev) => (prev === token ? null : token));
    };

    const handleColorSelect = (token: string, selection: ColorSelection) => {
        setCustomColors((prev) => ({ ...prev, [token]: selection }));
        setCSSVar(`--color-surface-${token}`, colorSelectionToCSSValue(selection));
    };

    const handleReset = (token: string) => {
        setCustomColors((prev) => {
            const next = { ...prev };
            delete next[token];
            return next;
        });
        resetCSSVar(`--color-surface-${token}`);
        setExpandedToken(null);
    };

    return (
        <Section title="SURFACES">
            {SURFACES.map((surface) => (
                <TokenFolder
                    key={surface.token}
                    label={surface.label}
                    cssVar={`--color-surface-${surface.token}`}
                    expanded={expandedToken === surface.token}
                    onToggle={() => handleToggle(surface.token)}
                    isCustom={surface.token in customColors}
                    onReset={() => handleReset(surface.token)}
                >
                    <ColorGrid
                        currentValue={
                            customColors[surface.token] ??
                            getDefaultColorSelection(`surface-${surface.token}`, basePalette, mode)
                        }
                        onSelect={(selection) => handleColorSelect(surface.token, selection)}
                        showWhiteBlack
                    />
                </TokenFolder>
            ))}
        </Section>
    );
}
