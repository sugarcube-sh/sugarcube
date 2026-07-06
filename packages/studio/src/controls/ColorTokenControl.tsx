import type { ColorBinding, ColorScaleConfig } from "@sugarcube-sh/core/client";
import { useCallback, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover/popover";
import {
    useCurrentContext,
    usePathIndex,
    useToken,
    useTokenStore,
    useVariableName,
} from "../store/hooks";
import { resolveTerminalPath, unwrapRef, wrapRef } from "../tokens/paths";
import { TokenPath } from "./TokenPath";
import { TokenRow } from "./TokenRow";
import { buildColorGrid } from "./color-grid";
import { labelForBinding } from "./path-utils";
import { ColorGrid } from "./pickers/ColorGrid";

type ColorTokenControlProps = {
    binding: ColorBinding;
    colorScale: ColorScaleConfig;
};

export function ColorTokenControl({ binding, colorScale }: ColorTokenControlProps) {
    const [value, setValue] = useToken<string>(binding.token);
    const pathIndex = usePathIndex();
    const currentContext = useCurrentContext();
    const variableName = useVariableName();
    const label = labelForBinding(binding);
    const [open, setOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    const { columns, rows, cells, byPath } = useMemo(
        () => buildColorGrid(colorScale, variableName),
        [colorScale, variableName],
    );

    const refPath = unwrapRef(value);
    const terminalPath = useTokenStore((state) => {
        if (!refPath) return "";
        return resolveTerminalPath(refPath, (p) =>
            pathIndex.readValue(state.resolved, p, currentContext),
        );
    });
    const currentOption = byPath.get(terminalPath);

    const handleOpenAutoFocus = useCallback(
        (e: Event) => {
            e.preventDefault();
            requestAnimationFrame(() => {
                const el = popoverRef.current?.querySelector<HTMLElement>(
                    `[data-path="${terminalPath}"]`,
                );
                el?.focus();
            });
        },
        [terminalPath],
    );

    return (
        <TokenRow path={binding.token} label={label}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                    className="select-trigger cluster w-full"
                    data-cluster-wrap="nowrap"
                >
                    <span
                        className="token-swatch"
                        style={{ backgroundColor: currentOption?.color ?? "transparent" }}
                        aria-hidden="true"
                    />
                    <TokenPath path={terminalPath} />
                </PopoverTrigger>
                <PopoverContent
                    ref={popoverRef}
                    className="p-2xs"
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
