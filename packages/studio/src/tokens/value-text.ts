import { cssColorFor } from "./color-value";
import { type ReadValue, isDimension } from "./dimension";
import { resolveTerminalPath } from "./paths";

export type { ReadValue } from "./dimension";

export function valueText(
    type: string | undefined,
    path: string,
    read: ReadValue,
): string | undefined {
    if (type === "color") return cssColorFor(path, read);

    const raw = read(resolveTerminalPath(path, read));
    if (raw === undefined || raw === null) return undefined;
    if (isDimension(raw)) return `${raw.value}${raw.unit}`;
    if (Array.isArray(raw)) return raw.join(", ");
    return typeof raw === "object" ? JSON.stringify(raw) : String(raw);
}
