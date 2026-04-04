import { PaletteSwatches } from "../components/PaletteSwatches";
import { Section } from "../components/Section";
import { ALL_PALETTES, type Palette } from "../data/palettes";
import { switchBasePalette } from "../hooks/useCSSVariables";

type BaseSectionProps = {
    basePalette: Palette;
    onBasePaletteChange: (palette: Palette) => void;
};

export function BaseSection({ basePalette, onBasePaletteChange }: BaseSectionProps) {
    const handleChange = (palette: Palette) => {
        onBasePaletteChange(palette);
        switchBasePalette(palette);
    };

    return (
        <Section title="BASE">
            <PaletteSwatches
                label=""
                value={basePalette}
                onChange={handleChange}
                palettes={ALL_PALETTES}
            />
        </Section>
    );
}
