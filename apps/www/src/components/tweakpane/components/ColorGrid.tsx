import { type KeyboardEvent, useCallback, useEffect, useRef } from "react";
import { ALL_PALETTES, type Palette, SCALE, type ScaleStep } from "../data/palettes";

export type ColorSelection =
    | { type: "palette"; palette: Palette; step: ScaleStep }
    | { type: "white" }
    | { type: "black" };

type ColorGridProps = {
    currentValue?: ColorSelection | undefined;
    onSelect: (selection: ColorSelection) => void;
    showWhiteBlack?: boolean;
};

const COLS = ALL_PALETTES.length;

export function ColorGrid({ currentValue, onSelect, showWhiteBlack = false }: ColorGridProps) {
    const gridRef = useRef<HTMLDivElement>(null);

    const isSelected = (selection: ColorSelection): boolean => {
        if (!currentValue) return false;
        if (selection.type !== currentValue.type) return false;
        if (selection.type === "palette" && currentValue.type === "palette") {
            return (
                selection.palette === currentValue.palette && selection.step === currentValue.step
            );
        }
        return true;
    };

    // Find the flat index of the currently selected palette swatch
    const getSelectedIndex = (): number => {
        if (!currentValue || currentValue.type !== "palette") return 0;
        const colIndex = ALL_PALETTES.indexOf(currentValue.palette);
        const rowIndex = SCALE.indexOf(currentValue.step);
        if (colIndex === -1 || rowIndex === -1) return 0;
        return rowIndex * COLS + colIndex;
    };

    const totalSwatches = SCALE.length * COLS;

    // Auto-focus the selected swatch when the grid mounts (folder expands)
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
    useEffect(() => {
        const grid = gridRef.current;
        if (!grid) return;
        const buttons = grid.querySelectorAll<HTMLElement>("button");
        const idx = getSelectedIndex();
        buttons[idx]?.focus();
    }, []);

    const focusAndSelect = useCallback(
        (index: number) => {
            const grid = gridRef.current;
            if (!grid) return;
            const buttons = grid.querySelectorAll<HTMLElement>("button");
            const btn = buttons[index];
            if (!btn) return;
            btn.focus();

            const rowIndex = Math.floor(index / COLS);
            const colIndex = index % COLS;
            onSelect({
                type: "palette",
                palette: ALL_PALETTES[colIndex],
                step: SCALE[rowIndex],
            });
        },
        [onSelect]
    );

    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            const grid = gridRef.current;
            if (!grid) return;
            const buttons = Array.from(grid.querySelectorAll<HTMLElement>("button"));
            const currentIndex = buttons.findIndex((el) => el === document.activeElement);
            if (currentIndex === -1) return;

            let nextIndex: number | null = null;

            switch (e.key) {
                case "ArrowRight":
                    nextIndex = currentIndex + 1 < totalSwatches ? currentIndex + 1 : null;
                    break;
                case "ArrowLeft":
                    nextIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : null;
                    break;
                case "ArrowDown":
                    nextIndex = currentIndex + COLS < totalSwatches ? currentIndex + COLS : null;
                    break;
                case "ArrowUp":
                    nextIndex = currentIndex - COLS >= 0 ? currentIndex - COLS : null;
                    break;
                case "Home":
                    nextIndex = 0;
                    break;
                case "End":
                    nextIndex = totalSwatches - 1;
                    break;
                default:
                    return;
            }

            if (nextIndex === null) return;
            e.preventDefault();
            focusAndSelect(nextIndex);
        },
        [totalSwatches, focusAndSelect]
    );

    const selectedIndex = getSelectedIndex();

    return (
        <div className="color-grid">
            {showWhiteBlack && (
                <div className="color-grid-special">
                    <button
                        type="button"
                        className="color-grid-swatch color-grid-swatch-white"
                        data-selected={isSelected({ type: "white" })}
                        onClick={() => onSelect({ type: "white" })}
                        aria-label="White"
                    />
                    <button
                        type="button"
                        className="color-grid-swatch color-grid-swatch-black"
                        data-selected={isSelected({ type: "black" })}
                        onClick={() => onSelect({ type: "black" })}
                        aria-label="Black"
                    />
                </div>
            )}

            {/* All palettes in one grid — single Tab stop, arrow keys navigate */}
            <div
                className="color-grid-palettes"
                ref={gridRef}
                role="grid"
                aria-label="Color palette"
                onKeyDown={onKeyDown}
            >
                {SCALE.map((step, rowIndex) => (
                    <div key={step} className="color-grid-row" role="row">
                        {ALL_PALETTES.map((palette, colIndex) => {
                            const flatIndex = rowIndex * COLS + colIndex;
                            return (
                                <button
                                    key={`${palette}-${step}`}
                                    type="button"
                                    role="gridcell"
                                    className="color-grid-swatch"
                                    style={{
                                        backgroundColor: `var(--color-${palette}-${step})`,
                                    }}
                                    data-selected={isSelected({ type: "palette", palette, step })}
                                    tabIndex={flatIndex === selectedIndex ? 0 : -1}
                                    onClick={() => onSelect({ type: "palette", palette, step })}
                                    aria-label={`${palette} ${step}`}
                                />
                            );
                        })}
                    </div>
                ))}
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
