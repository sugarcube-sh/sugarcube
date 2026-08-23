"use client";

import cn from "clsx";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef } from "react";
import type { PaletteRamp } from "../../tokens/palettes";

type ColorGridProps = {
    ramps: PaletteRamp[];
    value: string | undefined;
    onSelect: (value: string) => void;
    onPreview?: (value: string) => void;
    focusSignal?: number;
};

export function gridColumns(ramps: PaletteRamp[]): number {
    return ramps.reduce((widest, ramp) => Math.max(widest, ramp.steps.length), 0);
}

export function ColorGrid({ ramps, value, onSelect, onPreview, focusSignal }: ColorGridProps) {
    const gridRef = useRef<HTMLDivElement>(null);

    const columns = useMemo(() => gridColumns(ramps), [ramps]);

    const rows = useMemo(
        () =>
            ramps
                .filter((ramp) => ramp.steps.length > 0)
                .map((ramp) => ({ palette: ramp.name, cells: ramp.steps })),
        [ramps],
    );

    const tabbablePath = useMemo(() => {
        const all = rows.flatMap((row) => row.cells);
        return all.find((cell) => cell.value === value)?.value ?? all[0]?.value;
    }, [rows, value]);

    useEffect(() => {
        if (!focusSignal) return;
        gridRef.current?.querySelector<HTMLElement>('[data-path][tabindex="0"]')?.focus();
    }, [focusSignal]);

    const focusCell = useCallback((row: number, col: number) => {
        const cell = gridRef.current?.querySelector<HTMLElement>(
            `[data-row="${row}"][data-col="${col}"]`,
        );
        cell?.focus();
    }, []);

    const activeCell = useCallback((): [number, number] | null => {
        const el = document.activeElement as HTMLElement | null;
        const row = el?.dataset.row;
        const col = el?.dataset.col;
        if (row === undefined || col === undefined) return null;
        return [Number(row), Number(col)];
    }, []);

    const findNext = useCallback(
        (row: number, col: number, dr: number, dc: number): [number, number] | null => {
            if (dc !== 0) {
                const next = col + dc;
                const cells = rows[row]?.cells ?? [];
                return next >= 0 && next < cells.length ? [row, next] : null;
            }

            const cells = rows[row + dr]?.cells;
            if (!cells) return null;
            return [row + dr, Math.min(col, cells.length - 1)];
        },
        [rows],
    );

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            const pos = activeCell();
            if (!pos) return;
            const [row, col] = pos;

            const directions: Record<string, [number, number]> = {
                ArrowUp: [-1, 0],
                ArrowDown: [1, 0],
                ArrowLeft: [0, -1],
                ArrowRight: [0, 1],
            };

            const direction = directions[event.key];
            if (direction) {
                const next = findNext(row, col, direction[0], direction[1]);
                if (next) {
                    event.preventDefault();
                    focusCell(next[0], next[1]);
                }
                return;
            }

            if (event.key === "Home" || event.key === "End") {
                const cells = rows[row]?.cells ?? [];
                if (cells.length === 0) return;
                event.preventDefault();
                focusCell(row, event.key === "Home" ? 0 : cells.length - 1);
            }
        },
        [activeCell, findNext, focusCell, rows],
    );

    return (
        <div
            ref={gridRef}
            role="grid"
            aria-label="Colors"
            tabIndex={-1}
            className="color-grid"
            style={{ "--color-grid-columns": columns } as React.CSSProperties}
            onKeyDown={handleKeyDown}
        >
            {rows.map((row, rowIndex) => (
                <div key={row.palette} className="color-grid-group">
                    <span className="color-grid-heading" aria-hidden>
                        {row.palette}
                    </span>
                    {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- CSS grid layout, not an HTML table */}
                    <div role="row" aria-label={row.palette} className="color-grid-row">
                        {row.cells.map((cell, colIndex) => (
                            // The button *is* the gridcell rather than sitting inside one.
                            // aria-selected isn't valid on a button's implicit role, and this
                            // way the selected state is exposed on the element that takes
                            // focus, while Enter/Space/click stay native.
                            <button
                                key={cell.step}
                                type="button"
                                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a <td> would need a <table>; this is a CSS grid of buttons
                                role="gridcell"
                                className={cn("swatch", "color-grid-swatch")}
                                style={{ "--swatch-color": cell.css } as React.CSSProperties}
                                data-row={rowIndex}
                                data-col={colIndex}
                                data-path={cell.value}
                                aria-label={`${row.palette} ${cell.step}`}
                                aria-selected={cell.value === value}
                                tabIndex={cell.value === tabbablePath ? 0 : -1}
                                onFocus={() => onPreview?.(cell.value)}
                                onClick={() => onSelect(cell.value)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
