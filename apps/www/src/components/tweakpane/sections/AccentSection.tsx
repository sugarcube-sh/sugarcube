import { PaletteSwatches } from "../components/PaletteSwatches";
import { Section } from "../components/Section";
import { ALL_PALETTES, type Palette } from "../data/palettes";
import { switchAccentPalette } from "../hooks/useCSSVariables";

type AccentSectionProps = {
    accentPalette: Palette;
    onAccentPaletteChange: (palette: Palette) => void;
};

export function AccentSection({ accentPalette, onAccentPaletteChange }: AccentSectionProps) {
    const handleChange = (palette: Palette) => {
        onAccentPaletteChange(palette);
        switchAccentPalette(palette);
    };

    return (
        <Section title="ACCENT">
            <PaletteSwatches
                label=""
                value={accentPalette}
                onChange={handleChange}
                palettes={ALL_PALETTES}
            />
        </Section>
    );
}
