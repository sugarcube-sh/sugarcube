/**
 * Turns camelCase and PascalCase words into lowercase words joined by `-`.
 *
 * @param text - The text to change, such as `"brandPrimary"`.
 *
 * @example
 * kebabCase("brandPrimary")
 * // => "brand-primary"
 *
 * @example
 * // In variables.variableName, for the token color.brandPrimary
 * variableName: (path) => `ds-${kebabCase(path.replaceAll(".", "-"))}`
 * // => --ds-color-brand-primary
 */
export function kebabCase(text: string): string {
    return text
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z])(?=[a-z])/g, "$1-$2")
        .toLowerCase();
}
