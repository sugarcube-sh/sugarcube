/**
 * Checks whether a JSON value is an object.
 *
 * Arrays, `null`, strings and numbers are not.
 *
 * @param value - Any value, such as what a token writes under your `$extensions` key.
 *
 * @example
 * // An object
 * isJsonObject({ min: 4 })
 * // => true
 *
 * @example
 * // A list isn't one
 * isJsonObject([4, 8])
 * // => false
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
