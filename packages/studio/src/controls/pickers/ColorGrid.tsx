import { type KeyboardEvent, useCallback, useRef, useState } from "react";

export type GridOption = {
    path: string;
    color: string;
    label: string;
};

type GridCell = GridOption | null;

type Props = {
    columns: readonly string[];
    rows: readonly string[];
    cells: GridCell[][];
    currentPath: string;
    onSelect: (path: string) => void;
    onCommit: () => void;
    onCancel: () => void;
};

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
        [cells, onSelect],
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
        [cells, rows.length, colCount],
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
        ],
    );

    const handlePick = useCallback(
        (path: string) => {
            onSelect(path);
            onCommit();
        },
        [onSelect, onCommit],
    );

    return (
        <div
            ref={gridRef}
            role="grid"
            aria-label="Color picker"
            tabIndex={0}
            className="color-grid"
            style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
            onKeyDown={handleKeyDown}
        >
            {rows.map((row, rowIdx) => (
                <div
                    key={row}
                    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- CSS grid layout with display:contents, not an HTML <table>
                    role="row"
                    className="color-grid-row"
                    style={{ display: "contents" }}
                >
                    {columns.map((col, colIdx) => {
                        const option = cells[rowIdx]?.[colIdx];
                        return (
                            <div
                                key={col}
                                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- CSS grid layout, not an HTML <table> cell
                                role="gridcell"
                            >
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
            aria-pressed={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onPick(option.path)}
        />
    );
}
