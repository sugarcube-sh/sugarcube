import { type KeyboardEvent, useCallback, useEffect, useRef } from "react";
import { parseReference } from "../../store/palette-discovery";
import { joinTokenPath } from "../controls/path-utils";

export type ColorSelection =
    | { type: "palette"; palette: string; step: string }
    | { type: "white" }
    | { type: "black" };

type ColorGridProps = {
    /** Available palette names (columns). */
    palettes: readonly string[];
    /** Available step names (rows). */
    steps: readonly string[];
    currentValue?: ColorSelection | undefined;
    onSelect: (selection: ColorSelection) => void;
    /**
     * Optional DTCG reference string for a "pure white" escape-hatch
     * swatch (e.g. `"{color.white}"`). If provided, the grid renders a
     * white swatch next to the palette grid; picking it emits a
     * `{ type: "white" }` selection.
     */
    whiteRef: string | undefined;
    /** Same as `whiteRef` but for black. */
    blackRef: string | undefined;
    /**
     * Construct the CSS `background-color` for a swatch.
     * Receives `(palette, step)` and returns a CSS value string.
     */
    swatchColor: (palette: string, step: string) => string;
};

export function ColorGrid({
    palettes,
    steps,
    currentValue,
    onSelect,
    whiteRef,
    blackRef,
    swatchColor,
}: ColorGridProps) {
    const showWhiteBlack = whiteRef !== undefined || blackRef !== undefined;
    const COLS = palettes.length;
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

    const getSelectedIndex = (): number => {
        if (!currentValue || currentValue.type !== "palette") return 0;
        const colIndex = palettes.indexOf(currentValue.palette);
        const rowIndex = steps.indexOf(currentValue.step);
        if (colIndex === -1 || rowIndex === -1) return 0;
        return rowIndex * COLS + colIndex;
    };

    const totalSwatches = steps.length * COLS;

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
            const palette = palettes[colIndex];
            const step = steps[rowIndex];
            if (!palette || !step) return;
            onSelect({ type: "palette", palette, step });
        },
        [COLS, palettes, steps, onSelect]
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
        [COLS, totalSwatches, focusAndSelect]
    );

    const selectedIndex = getSelectedIndex();

    return (
        <div className="color-grid">
            {showWhiteBlack && (
                <div className="color-grid-special">
                    {whiteRef !== undefined && (
                        <button
                            type="button"
                            className="color-grid-swatch color-grid-swatch-white"
                            data-selected={isSelected({ type: "white" })}
                            onClick={() => onSelect({ type: "white" })}
                            aria-label="White"
                        />
                    )}
                    {blackRef !== undefined && (
                        <button
                            type="button"
                            className="color-grid-swatch color-grid-swatch-black"
                            data-selected={isSelected({ type: "black" })}
                            onClick={() => onSelect({ type: "black" })}
                            aria-label="Black"
                        />
                    )}
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
                {steps.map((step, rowIndex) => (
                    <div key={step} className="color-grid-row" role="row">
                        {palettes.map((palette, colIndex) => {
                            const flatIndex = rowIndex * COLS + colIndex;
                            return (
                                <button
                                    key={`${palette}-${step}`}
                                    type="button"
                                    role="gridcell"
                                    className="color-grid-swatch"
                                    style={{
                                        backgroundColor: swatchColor(palette, step),
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
 * Convert a ColorSelection to a DTCG token reference string, using
 * the palette's parent group path to construct the full token path.
 *
 * @param selection    - The color selection from the grid.
 * @param paletteParent - The parent path that palettes live under
 *                        (e.g. `"color"` if palettes are `color.blue`, `color.red`).
 *                        Pass `""` for palettes at the token tree root.
 * @param whiteRef     - Reference to emit for a "white" selection. Required
 *                        when the grid is showing a white swatch.
 * @param blackRef     - Reference to emit for a "black" selection. Required
 *                        when the grid is showing a black swatch.
 */
export function colorSelectionToTokenReference(
    selection: ColorSelection,
    paletteParent: string,
    whiteRef?: string,
    blackRef?: string
): string {
    switch (selection.type) {
        case "white":
            return whiteRef ?? "";
        case "black":
            return blackRef ?? "";
        case "palette":
            return `{${joinTokenPath(paletteParent, selection.palette, selection.step)}}`;
    }
}

/**
 * Inverse: parse a token reference back into a ColorSelection.
 * Uses the palette parent path to determine the palette name and step.
 *
 * @param value         - The token `$value` (a DTCG reference string).
 * @param paletteParent - The parent path (e.g. `"color"`). Pass `""`
 *                        for palettes at the token tree root.
 * @param whiteRef      - Reference that represents "white", if any.
 * @param blackRef      - Reference that represents "black", if any.
 */
export function tokenReferenceToColorSelection(
    value: unknown,
    paletteParent: string,
    whiteRef?: string,
    blackRef?: string
): ColorSelection | undefined {
    if (typeof value !== "string") return undefined;

    if (whiteRef !== undefined && value === whiteRef) return { type: "white" };
    if (blackRef !== undefined && value === blackRef) return { type: "black" };

    const refPath = parseReference(value);
    if (!refPath) return undefined;

    // Normalize the parent into its canonical dotted form so we can
    // match the reference path regardless of how the user wrote it.
    const normalizedParent = joinTokenPath(paletteParent);
    const stripPrefix = normalizedParent ? `${normalizedParent}.` : "";
    if (stripPrefix && !refPath.startsWith(stripPrefix)) return undefined;

    const remainder = refPath.substring(stripPrefix.length);
    const dotPos = remainder.indexOf(".");
    if (dotPos === -1) return undefined;

    const palette = remainder.substring(0, dotPos);
    const step = remainder.substring(dotPos + 1);
    if (!palette || !step) return undefined;

    return { type: "palette", palette, step };
}

/**
 * Convert a ColorSelection to a display string.
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
