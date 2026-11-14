/**
 * Rounds a number to a number of decimal places.
 *
 * @param value - The number to round, such as `4.799999999999999`.
 * @param precision - The decimal places to keep, such as `2`. It's `4` when left out.
 *
 * @example
 * roundTo(4.799999999999999)
 * // => 4.8
 */
export function roundTo(value: number, precision = 4): number {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
}
