import { CORNER_PRESETS, type CornerPreset } from "../data/palettes";

type CornerPresetsProps = {
  value: CornerPreset;
  onChange: (preset: CornerPreset) => void;
};

const PRESET_ICONS: Record<CornerPreset, string> = {
  sharp: "▢",
  subtle: "◰",
  rounded: "▣",
  pill: "⬭",
};

export function CornerPresets({ value, onChange }: CornerPresetsProps) {
  const presets = Object.keys(CORNER_PRESETS) as CornerPreset[];

  return (
    <div className="tweakpane-corner-presets">
      <span className="tweakpane-corner-label">Corners</span>
      <div className="tweakpane-corner-buttons" role="radiogroup" aria-label="Corner style">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            role="radio"
            aria-checked={value === preset}
            aria-label={preset}
            className="tweakpane-corner-button"
            data-preset={preset}
            data-selected={value === preset}
            onClick={() => onChange(preset)}
          >
            {PRESET_ICONS[preset]}
          </button>
        ))}
      </div>
    </div>
  );
}
