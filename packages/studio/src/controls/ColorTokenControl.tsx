import type { ResolvedTokens } from "@sugarcube-sh/core";
import {
    type ColorBinding,
    type ColorScaleConfig,
    formatCSSVarName,
} from "@sugarcube-sh/core/client";
import { useCallback, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover/popover";
import { useCurrentContext, usePathIndex, useToken, useTokenStore } from "../store/hooks";
import type { PathIndex } from "../tokens/path-index";
import { TokenRow } from "./TokenRow";
import { joinTokenPath, unwrapRef, wrapRef } from "./path-utils";
import { ColorGrid, type GridOption } from "./pickers/ColorGrid";
import { labelForBinding } from "./resolver";

type ColorTokenControlProps = {
    binding: ColorBinding;
    colorScale: ColorScaleConfig;
};

/**
 * Renders a token row whose control opens a 2D color grid in a popover.
 *
 * The grid is a proper color picker: arrow keys navigate AND apply the
 * new value live (so the page updates as you scan), Enter/click commits
 * + closes, Escape reverts to the value the popover opened with + closes.
 *
 * The grid shows every `colorScale.palettes × colorScale.steps` combination,
 * with optional white/black as an extra column. Follows the token's
 * reference chain down to the terminal palette.step so the current selection
 * highlights correctly even when tokens alias through intermediate semantics.
 */
export function ColorTokenControl({ binding, colorScale }: ColorTokenControlProps) {
    const [value, setValue] = useToken<string>(binding.token);
    const pathIndex = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const currentContext = useCurrentContext();
    const label = labelForBinding(binding);
    const [open, setOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    const { columns, rows, cells, byPath } = useMemo(() => buildGrid(colorScale), [colorScale]);

    const terminalPath = resolveRefChain(value, pathIndex, resolved, currentContext) ?? "";
    const currentOption = byPath.get(terminalPath);

    const handleOpenAutoFocus = useCallback(
        (e: Event) => {
            e.preventDefault();
            requestAnimationFrame(() => {
                const el = popoverRef.current?.querySelector<HTMLElement>(
                    `[data-path="${terminalPath}"]`
                );
                el?.focus();
            });
        },
        [terminalPath]
    );

    return (
        <TokenRow path={binding.token} label={label}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger className="token-picker-trigger">
                    <span
                        className="token-swatch"
                        style={{ backgroundColor: currentOption?.color ?? "transparent" }}
                        aria-hidden="true"
                    />
                    <span className="token-picker-path">{terminalPath}</span>
                </PopoverTrigger>
                <PopoverContent
                    ref={popoverRef}
                    className="color-grid-popover"
                    onOpenAutoFocus={handleOpenAutoFocus}
                >
                    <ColorGrid
                        columns={columns}
                        rows={rows}
                        cells={cells}
                        currentPath={terminalPath}
                        onSelect={(path) => setValue(wrapRef(path))}
                        onCommit={() => setOpen(false)}
                        onCancel={() => setOpen(false)}
                    />
                </PopoverContent>
            </Popover>
        </TokenRow>
    );
}

type BuiltGrid = {
    columns: string[];
    rows: string[];
    cells: (GridOption | null)[][];
    byPath: Map<string, GridOption>;
};

function buildGrid(colorScale: ColorScaleConfig): BuiltGrid {
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
                color: `var(--${formatCSSVarName(path)})`,
                label: `${palette} ${step}`,
            };
            byPath.set(path, option);
            return option;
        });

        // Extra column: white and black together at the top
        if (hasExtras) {
            const extraToken = rowIdx === 0 ? white : rowIdx === 1 ? black : undefined;
            if (extraToken) {
                const label = extraToken.split(".").pop() ?? extraToken;
                const option: GridOption = {
                    path: extraToken,
                    color: `var(--${formatCSSVarName(extraToken)})`,
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

/**
 * Walk a DTCG reference chain to its terminal token path, staying in the
 * active permutation context so cross-mode references don't get confused.
 *
 * Returns the path whose `$value` is not itself a reference string.
 */
function resolveRefChain(
    value: unknown,
    pathIndex: PathIndex,
    resolved: ResolvedTokens,
    context: string
): string | undefined {
    if (typeof value !== "string") return undefined;
    let current: unknown = value;
    const seen = new Set<string>();
    let lastPath: string | undefined;

    while (typeof current === "string") {
        const path = unwrapRef(current);
        if (path === undefined) return lastPath;
        if (seen.has(path)) return path;
        seen.add(path);
        lastPath = path;
        current = pathIndex.readValue(resolved, path, context);
    }
    return lastPath;
}
