import type { ResolvedToken } from "@sugarcube-sh/core/client";
import { resolveTerminalPath } from "./paths";

export type Dimensionish = { value: number; unit: string };
export type ReadValue = (path: string) => unknown;

export function isDimension(value: unknown): value is Dimensionish {
    return (
        typeof value === "object" &&
        value !== null &&
        "value" in value &&
        "unit" in value &&
        typeof (value as Dimensionish).value === "number" &&
        typeof (value as Dimensionish).unit === "string"
    );
}

/**
 * Walks the chain rather than reading `$resolvedValue`, which is a snapshot from
 * load time. An edit to a token several hops away has to show up here.
 */
export function dimensionAt(path: string, read: ReadValue): Dimensionish | undefined {
    const value = read(resolveTerminalPath(path, read));
    return isDimension(value) ? value : undefined;
}

export function cssLengthFor(path: string, read: ReadValue): string | undefined {
    const dimension = dimensionAt(path, read);
    return dimension ? `${dimension.value}${dimension.unit}` : undefined;
}

/** A length that can be drawn. `ms` is a dimension in DTCG but not a width. */
export function lengthOf(token: ResolvedToken, read: ReadValue): string | undefined {
    if (token.$type !== "dimension") return undefined;
    return cssLengthFor(token.$path, read);
}
