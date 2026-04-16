import type { ResolvedTokens } from "@sugarcube-sh/core";
import {
    type ColorBinding,
    type ColorScaleConfig,
    formatCSSVarName,
} from "@sugarcube-sh/core/client";
import { useMemo, useState } from "react";
import type { PathIndex } from "../../store/path-index";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover/popover";
import { usePathIndex, useToken, useTokenStore } from "../store/hooks";
import { TokenRow } from "./TokenRow";
import { joinTokenPath } from "./path-utils";
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
 * plus optional white/black "neutrals" above the grid. Follows the token's
 * reference chain down to the terminal palette.step so the current selection
 * highlights correctly even when tokens alias through intermediate semantics.
 */
export function ColorTokenControl({ binding, colorScale }: ColorTokenControlProps) {
    const [value, setValue] = useToken<string>(binding.token);
    const pathIndex = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const label = labelForBinding(binding);
    const [open, setOpen] = useState(false);

    const { paletteOptions, neutralOptions, byPath } = useMemo(
        () => buildOptions(colorScale),
        [colorScale]
    );

    const terminalPath = resolveRefChain(value, pathIndex, resolved) ?? "";
    const currentOption = byPath.get(terminalPath);

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
                <PopoverContent className="color-grid-popover">
                    <ColorGrid
                        palettes={colorScale.palettes}
                        steps={colorScale.steps}
                        paletteOptions={paletteOptions}
                        neutralOptions={neutralOptions}
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

type BuiltOptions = {
    paletteOptions: GridOption[];
    neutralOptions: GridOption[];
    byPath: Map<string, GridOption>;
};

function buildOptions(colorScale: ColorScaleConfig): BuiltOptions {
    const { prefix, palettes, steps, white, black } = colorScale;
    const paletteOptions: GridOption[] = [];
    const neutralOptions: GridOption[] = [];
    const byPath = new Map<string, GridOption>();

    // Row-major: iterate steps (rows), then palettes (columns), so index order
    // matches the grid's visual layout for arrow-key navigation.
    for (const step of steps) {
        for (const palette of palettes) {
            const path = joinTokenPath(prefix, palette, step);
            const option: GridOption = {
                path,
                color: `var(--${formatCSSVarName(path)})`,
                palette,
                step,
                label: `${palette} ${step}`,
            };
            paletteOptions.push(option);
            byPath.set(path, option);
        }
    }

    for (const neutral of [white, black]) {
        if (!neutral) continue;
        const label = neutral.split(".").pop() ?? neutral;
        const option: GridOption = {
            path: neutral,
            color: `var(--${formatCSSVarName(neutral)})`,
            label,
        };
        neutralOptions.push(option);
        byPath.set(neutral, option);
    }

    return { paletteOptions, neutralOptions, byPath };
}

/**
 * Walk a DTCG reference chain to its terminal token path.
 * Returns the path whose `$value` is not itself a reference string.
 */
function resolveRefChain(
    value: unknown,
    pathIndex: PathIndex,
    resolved: ResolvedTokens
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
        current = pathIndex.readValue(resolved, path);
    }
    return lastPath;
}

function wrapRef(path: string): string {
    return `{${path}}`;
}

function unwrapRef(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        return trimmed.slice(1, -1);
    }
    return undefined;
}
