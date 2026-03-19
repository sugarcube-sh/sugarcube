import { PALETTES, SCALE, type Palette, type ScaleStep } from "../data/palettes";

export type ColorSelection =
  | { type: "palette"; palette: Palette; step: ScaleStep }
  | { type: "white" }
  | { type: "black" };

type ColorGridProps = {
  currentValue?: ColorSelection | undefined;
  onSelect: (selection: ColorSelection) => void;
};

export function ColorGrid({ currentValue, onSelect }: ColorGridProps) {
  const isSelected = (selection: ColorSelection): boolean => {
    if (!currentValue) return false;
    if (selection.type !== currentValue.type) return false;
    if (selection.type === "palette" && currentValue.type === "palette") {
      return selection.palette === currentValue.palette && selection.step === currentValue.step;
    }
    return true;
  };

  return (
    <div className="color-grid">
      {/* Special colors: white and black */}
      <div className="color-grid-special">
        <button
          type="button"
          className="color-grid-swatch color-grid-swatch-white"
          data-selected={isSelected({ type: "white" })}
          onClick={() => onSelect({ type: "white" })}
          aria-label="White"
        >
          <span className="color-grid-swatch-label">white</span>
        </button>
        <button
          type="button"
          className="color-grid-swatch color-grid-swatch-black"
          data-selected={isSelected({ type: "black" })}
          onClick={() => onSelect({ type: "black" })}
          aria-label="Black"
        >
          <span className="color-grid-swatch-label">black</span>
        </button>
      </div>

      {/* Grey palettes */}
      <div className="color-grid-section">
        <div className="color-grid-section-label">Greys</div>
        <div className="color-grid-palettes" data-columns={PALETTES.greys.length}>
          {SCALE.map((step) => (
            <div key={step} className="color-grid-row">
              {PALETTES.greys.map((palette) => (
                <button
                  key={`${palette}-${step}`}
                  type="button"
                  className="color-grid-swatch"
                  style={{
                    backgroundColor: `var(--color-${palette}-${step})`,
                  }}
                  data-selected={isSelected({ type: "palette", palette, step })}
                  onClick={() => onSelect({ type: "palette", palette, step })}
                  aria-label={`${palette} ${step}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Chromatic palettes */}
      <div className="color-grid-section">
        <div className="color-grid-section-label">Colors</div>
        <div className="color-grid-palettes" data-columns={PALETTES.colors.length}>
          {SCALE.map((step) => (
            <div key={step} className="color-grid-row">
              {PALETTES.colors.map((palette) => (
                <button
                  key={`${palette}-${step}`}
                  type="button"
                  className="color-grid-swatch"
                  style={{
                    backgroundColor: `var(--color-${palette}-${step})`,
                  }}
                  data-selected={isSelected({ type: "palette", palette, step })}
                  onClick={() => onSelect({ type: "palette", palette, step })}
                  aria-label={`${palette} ${step}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Convert a ColorSelection to a CSS value
 */
export function colorSelectionToCSSValue(selection: ColorSelection): string {
  switch (selection.type) {
    case "white":
      return "var(--color-white)";
    case "black":
      return "var(--color-black)";
    case "palette":
      return `var(--color-${selection.palette}-${selection.step})`;
  }
}

/**
 * Convert a ColorSelection to a display string
 */
export function colorSelectionToDisplayValue(selection: ColorSelection): string {
  switch (selection.type) {
    case "white":
      return "white";
    case "black":
      return "black";
    case "palette":
      return `${selection.palette}.${selection.step}`;
  }
}
