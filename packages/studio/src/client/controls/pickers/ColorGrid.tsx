import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

export type GridOption = {
    /** Token path to emit on selection (e.g. "color.neutral.500"). */
    path: string;
    /** Resolved CSS color for the swatch. */
    color: string;
    /** Palette column this option belongs to. Undefined for neutrals (white/black). */
    palette?: string;
    /** Step row this option belongs to. Undefined for neutrals. */
    step?: string;
    /** Label for accessibility. */
    label: string;
};

type Props = {
    /** Palette column order. */
    palettes: readonly string[];
    /** Step row order. */
    steps: readonly string[];
    /** All palette cells (rows × columns flattened). */
    paletteOptions: GridOption[];
    /** Optional neutral chips (white, black, etc.) rendered above the grid. */
    neutralOptions: GridOption[];
    /** Current value's token path. */
    currentPath: string;
    /** Fires on navigation (live apply) and on click. */
    onSelect: (path: string) => void;
    /** Called when user confirms selection (Enter or click). Closes the popover. */
    onCommit: () => void;
    /** Called when user cancels. Consumer should revert and close. */
    onCancel: () => void;
};

/**
 * 2D color picker grid.
 *
 * - Columns = palettes, rows = steps; neutrals as a separate strip.
 * - Single tab stop; arrows navigate WITHIN the grid.
 * - Navigation fires `onSelect` immediately so the page updates live.
 * - Enter / click → commit (close popover).
 * - Escape → cancel (revert to initial, close popover).
 */
export function ColorGrid({
    palettes,
    steps,
    paletteOptions,
    neutralOptions,
    currentPath,
    onSelect,
    onCommit,
    onCancel,
}: Props) {
    const gridRef = useRef<HTMLDivElement>(null);
    const COLS = palettes.length;

    // Capture the value the grid opened with — used by Escape to revert.
    const [initialPath] = useState(currentPath);

    // Auto-focus the current swatch on mount.
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
    useEffect(() => {
        const el = gridRef.current?.querySelector<HTMLElement>(`[data-path="${currentPath}"]`);
        el?.focus();
    }, []);

    const focusPath = useCallback(
        (path: string) => {
            const el = gridRef.current?.querySelector<HTMLElement>(`[data-path="${path}"]`);
            if (!el) return;
            el.focus();
            onSelect(path);
        },
        [onSelect]
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onSelect(initialPath);
                onCancel();
                return;
            }

            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCommit();
                return;
            }

            const activeEl = document.activeElement as HTMLElement | null;
            const activePath = activeEl?.dataset.path;
            if (!activePath) return;

            const neutralIdx = neutralOptions.findIndex((o) => o.path === activePath);
            const paletteIdx = paletteOptions.findIndex((o) => o.path === activePath);

            // Focus is on a neutral chip (white/black row above the grid).
            if (neutralIdx !== -1) {
                let nextPath: string | null = null;
                switch (e.key) {
                    case "ArrowRight":
                        nextPath =
                            neutralIdx + 1 < neutralOptions.length
                                ? (neutralOptions[neutralIdx + 1]?.path ?? null)
                                : null;
                        break;
                    case "ArrowLeft":
                        nextPath =
                            neutralIdx - 1 >= 0
                                ? (neutralOptions[neutralIdx - 1]?.path ?? null)
                                : null;
                        break;
                    case "ArrowDown":
                        // Drop into the palette grid, matching column if possible.
                        nextPath =
                            paletteOptions[Math.min(neutralIdx, paletteOptions.length - 1)]?.path ??
                            null;
                        break;
                    default:
                        return;
                }
                if (nextPath === null) return;
                e.preventDefault();
                focusPath(nextPath);
                return;
            }

            // Focus is on a palette swatch.
            if (paletteIdx !== -1) {
                let nextPath: string | null = null;
                const col = paletteIdx % COLS;
                switch (e.key) {
                    case "ArrowRight":
                        nextPath =
                            paletteIdx + 1 < paletteOptions.length
                                ? (paletteOptions[paletteIdx + 1]?.path ?? null)
                                : null;
                        break;
                    case "ArrowLeft":
                        nextPath =
                            paletteIdx - 1 >= 0
                                ? (paletteOptions[paletteIdx - 1]?.path ?? null)
                                : null;
                        break;
                    case "ArrowDown":
                        nextPath =
                            paletteIdx + COLS < paletteOptions.length
                                ? (paletteOptions[paletteIdx + COLS]?.path ?? null)
                                : null;
                        break;
                    case "ArrowUp":
                        if (paletteIdx - COLS >= 0) {
                            nextPath = paletteOptions[paletteIdx - COLS]?.path ?? null;
                        } else if (neutralOptions.length > 0) {
                            // Top palette row → escape up into neutrals, matching column.
                            const targetIdx = Math.min(col, neutralOptions.length - 1);
                            nextPath = neutralOptions[targetIdx]?.path ?? null;
                        }
                        break;
                    case "Home":
                        nextPath = paletteOptions[0]?.path ?? null;
                        break;
                    case "End":
                        nextPath = paletteOptions[paletteOptions.length - 1]?.path ?? null;
                        break;
                    default:
                        return;
                }
                if (nextPath === null) return;
                e.preventDefault();
                focusPath(nextPath);
            }
        },
        [neutralOptions, paletteOptions, COLS, focusPath, onCommit, onCancel, onSelect, initialPath]
    );

    return (
        <div className="color-grid-wrapper" onKeyDown={handleKeyDown}>
            {neutralOptions.length > 0 && (
                <div className="color-grid-neutrals" role="group" aria-label="Neutral colors">
                    {neutralOptions.map((opt) => (
                        <Swatch
                            key={opt.path}
                            option={opt}
                            selected={opt.path === currentPath}
                            onPick={(path) => {
                                onSelect(path);
                                onCommit();
                            }}
                            onFocus={() => onSelect(opt.path)}
                        />
                    ))}
                </div>
            )}

            <div
                ref={gridRef}
                role="grid"
                aria-label="Palette colors"
                className="color-grid"
                style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
            >
                {steps.map((step, rowIdx) =>
                    palettes.map((palette, colIdx) => {
                        const flatIdx = rowIdx * COLS + colIdx;
                        const opt = paletteOptions[flatIdx];
                        if (!opt) return null;
                        return (
                            <Swatch
                                key={opt.path}
                                option={opt}
                                selected={opt.path === currentPath}
                                onPick={(path) => {
                                    onSelect(path);
                                    onCommit();
                                }}
                                onFocus={() => onSelect(opt.path)}
                            />
                        );
                    })
                )}
            </div>
        </div>
    );
}

function Swatch({
    option,
    selected,
    onPick,
    onFocus,
}: {
    option: GridOption;
    selected: boolean;
    onPick: (path: string) => void;
    onFocus: () => void;
}) {
    return (
        <button
            type="button"
            className="color-grid-swatch"
            data-path={option.path}
            data-selected={selected || undefined}
            style={{ backgroundColor: option.color }}
            aria-label={option.label}
            tabIndex={selected ? 0 : -1}
            onClick={() => onPick(option.path)}
            onFocus={onFocus}
        />
    );
}
