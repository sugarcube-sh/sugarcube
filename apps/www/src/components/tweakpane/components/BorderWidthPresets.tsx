import { BORDER_WIDTH_PRESETS, type BorderWidthPreset } from "../data/palettes";

type BorderWidthPresetsProps = {
  value: BorderWidthPreset;
  onChange: (preset: BorderWidthPreset) => void;
};

const PRESET_LABELS: Record<BorderWidthPreset, string> = {
  hairline: "Hairline",
  thin: "Thin",
  thick: "Thick",
};

export function BorderWidthPresets({ value, onChange }: BorderWidthPresetsProps) {
  const presets = Object.keys(BORDER_WIDTH_PRESETS) as BorderWidthPreset[];

  return (
    <div className="tweakpane-border-presets" role="radiogroup" aria-label="Border width">
      {presets.map((preset) => (
        <button
          key={preset}
          type="button"
          role="radio"
          aria-checked={value === preset}
          aria-label={PRESET_LABELS[preset]}
          className="tweakpane-border-button"
          data-preset={preset}
          data-selected={value === preset}
          onClick={() => onChange(preset)}
        >
          {PRESET_LABELS[preset]}
        </button>
      ))}
    </div>
  );
}
