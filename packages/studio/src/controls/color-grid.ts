import type { ColorScaleConfig } from "@sugarcube-sh/core/client";
import { joinTokenPath } from "../tokens/paths";
import type { GridOption } from "./pickers/ColorGrid";

export type ColorGridData = {
    columns: string[];
    rows: string[];
    cells: (GridOption | null)[][];
    byPath: Map<string, GridOption>;
};

export function buildColorGrid(
    colorScale: ColorScaleConfig,
    variableName: (path: string) => string
): ColorGridData {
    const { prefix, palettes, steps, white, black } = colorScale;
    const hasExtras = Boolean(white || black);
    const columns = hasExtras ? [...palettes, ""] : [...palettes];
    const rows = [...steps];
    const byPath = new Map<string, GridOption>();

    const cells: (GridOption | null)[][] = rows.map((step, rowIdx) => {
        const row: (GridOption | null)[] = palettes.map((palette) => {
            const path = joinTokenPath(prefix, palette, step);
            const option: GridOption = {
                path,
                color: `var(--${variableName(path)})`,
                label: `${palette} ${step}`,
            };
            byPath.set(path, option);
            return option;
        });

        if (hasExtras) {
            const extraToken = rowIdx === 0 ? white : rowIdx === 1 ? black : undefined;
            if (extraToken) {
                const label = extraToken.split(".").pop() ?? extraToken;
                const option: GridOption = {
                    path: extraToken,
                    color: `var(--${variableName(extraToken)})`,
                    label,
                };
                byPath.set(extraToken, option);
                row.push(option);
            } else {
                row.push(null);
            }
        }

        return row;
    });

    return { columns, rows, cells, byPath };
}
