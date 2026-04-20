import { type KeyboardEvent, useCallback, useRef, useState } from "react";

export type GridOption = {
    /** Token path to emit on selection (e.g. "color.neutral.500"). */
    path: string;
    /** Resolved CSS color for the swatch. */
    color: string;
    label: string;
};

type GridCell = GridOption | null;

type Props = {
    /** Column headers (palette names + optional extra column for white/black). */
    columns: readonly string[];
    rows: readonly string[];
    /** Row-major matrix of cells: `cells[row][col]`. Null entries are empty. */
    cells: GridCell[][];
    currentPath: string;
    /** Fires on navigation (live apply) and on click. */
    onSelect: (path: string) => void;
    /** Called when user confirms selection (Enter or click). Closes the popover. */
    onCommit: () => void;
    /** Called when user cancels. Consumer should revert and close. */
    onCancel: () => void;
};

/**
 * 2D color picker grid with ARIA grid semantics.
 *
 * - Columns = palettes, rows = steps.
 * - Single tab stop; arrows navigate within the grid.
 * - Arrow keys stop at row/column edges (no wrapping).
 * - Navigation fires `onSelect` immediately so the page updates live.
 * - Enter / click → commit (close popover).
 * - Escape → cancel (revert to initial, close popover).
 */
export function ColorGrid({
    columns,
    rows,
    cells,
    currentPath,
    onSelect,
    onCommit,
    onCancel,
}: Props) {
    const gridRef = useRef<HTMLDivElement>(null);
    const colCount = columns.length;

    // Capture the value the grid opened with — used by Escape to revert.
    const [initialPath] = useState(currentPath);

    const focusCell = useCallback(
        (row: number, col: number) => {
            const option = cells[row]?.[col];
            if (!option) return;
            const el = gridRef.current?.querySelector<HTMLElement>(`[data-path="${option.path}"]`);
            if (!el) return;
            el.focus();
            onSelect(option.path);
        },
        [cells, onSelect]
    );

    const findActiveCell = useCallback((): [number, number] | null => {
        const activePath = (document.activeElement as HTMLElement | null)?.dataset.path;
        if (!activePath) return null;
        for (let r = 0; r < cells.length; r++) {
            const row = cells[r];
            if (!row) continue;
            for (let c = 0; c < row.length; c++) {
                if (row[c]?.path === activePath) return [r, c];
            }
        }
        return null;
    }, [cells]);

    /**
     * Find the nearest non-empty cell in a direction from (row, col).
     * Skips over null cells so navigation feels natural with sparse grids.
     */
    const findNext = useCallback(
        (row: number, col: number, dr: number, dc: number): [number, number] | null => {
            let r = row + dr;
            let c = col + dc;
            while (r >= 0 && r < rows.length && c >= 0 && c < colCount) {
                if (cells[r]?.[c]) return [r, c];
                r += dr;
                c += dc;
            }
            return null;
        },
        [cells, rows.length, colCount]
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

            const pos = findActiveCell();
            if (!pos) return;
            const [row, col] = pos;

            const directions: Record<string, [number, number]> = {
                ArrowUp: [-1, 0],
                ArrowDown: [1, 0],
                ArrowLeft: [0, -1],
                ArrowRight: [0, 1],
            };

            const dir = directions[e.key];
            if (dir) {
                const next = findNext(row, col, dir[0], dir[1]);
                if (next) {
                    e.preventDefault();
                    focusCell(next[0], next[1]);
                }
                return;
            }

            if (e.key === "Home") {
                e.preventDefault();
                for (let c = 0; c < colCount; c++) {
                    if (cells[row]?.[c]) {
                        focusCell(row, c);
                        break;
                    }
                }
            } else if (e.key === "End") {
                e.preventDefault();
                for (let c = colCount - 1; c >= 0; c--) {
                    if (cells[row]?.[c]) {
                        focusCell(row, c);
                        break;
                    }
                }
            }
        },
        [
            findActiveCell,
            findNext,
            focusCell,
            onCommit,
            onCancel,
            onSelect,
            initialPath,
            cells,
            colCount,
        ]
    );

    const handlePick = useCallback(
        (path: string) => {
            onSelect(path);
            onCommit();
        },
        [onSelect, onCommit]
    );

    return (
        <div
            ref={gridRef}
            role="grid"
            aria-label="Color picker"
            className="color-grid"
            style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
            onKeyDown={handleKeyDown}
        >
            {rows.map((row, rowIdx) => (
                <div
                    key={row}
                    role="row"
                    className="color-grid-row"
                    style={{ display: "contents" }}
                >
                    {columns.map((col, colIdx) => {
                        const option = cells[rowIdx]?.[colIdx];
                        return (
                            <div key={col} role="gridcell">
                                {option && (
                                    <Swatch
                                        option={option}
                                        selected={option.path === currentPath}
                                        onPick={handlePick}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

function Swatch({
    option,
    selected,
    onPick,
}: {
    option: GridOption;
    selected: boolean;
    onPick: (path: string) => void;
}) {
    return (
        <button
            type="button"
            className="color-grid-swatch"
            data-path={option.path}
            style={{ backgroundColor: option.color }}
            aria-label={option.label}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onPick(option.path)}
        />
    );
}
