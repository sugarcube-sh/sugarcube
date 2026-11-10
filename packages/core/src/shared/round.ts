/**
 * Round to N decimals. Defaults to 4, the Utopia convention for fluid
 * scales. Kills binary-float drift (`4.799999999999999` becomes `4.8`),
 * preserves clean designer values, and is sub-pixel invisible
 * (≈0.0016px at the 4th decimal rem).
 */
export function roundTo(value: number, precision = 4): number {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
}
