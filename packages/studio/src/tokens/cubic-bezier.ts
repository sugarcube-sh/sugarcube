export type CubicBezierValue = [number, number, number, number];

export function readCubicBezier(value: unknown): CubicBezierValue | undefined {
    if (!Array.isArray(value) || value.length !== 4) return undefined;
    if (!value.every((part) => typeof part === "number" && Number.isFinite(part))) return undefined;
    return value as CubicBezierValue;
}

export function writeCubicBezier(text: string): CubicBezierValue | undefined {
    const parts = text.split(",").map((part) => Number(part.trim()));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return undefined;
    return parts as CubicBezierValue;
}
