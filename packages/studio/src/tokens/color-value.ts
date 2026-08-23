import { resolveTerminalPath, unwrapRef, wrapRef } from "./paths";

export type ColorValue = {
    authored: string;
    terminal: string;
};

export function directColor(path: string): ColorValue {
    return { authored: path, terminal: path };
}

export function readColorValue(
    value: unknown,
    readToken: (path: string) => unknown,
): ColorValue | undefined {
    const authored = unwrapRef(value);
    if (!authored) return undefined;
    return { authored, terminal: resolveTerminalPath(authored, readToken) };
}

export function colorValueToToken(value: ColorValue): string {
    return wrapRef(value.authored);
}
