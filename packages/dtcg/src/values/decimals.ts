export const colorDecimals = 4;

export function roundToDigits(value: number, digits: number): number {
    const factor = 10 ** digits;
    const scaled = Math.abs(value) * factor;
    return (Math.sign(value) * Math.round(scaled * (1 + 4 * Number.EPSILON))) / factor;
}
