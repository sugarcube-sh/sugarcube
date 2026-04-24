/**
 * Convert a string to kebab-case. Handles camelCase, PascalCase, and
 * consecutive capitals (e.g. `XMLParser` → `xml-parser`).
 *
 * Useful inside `variables.variableName` when you want kebab-cased output
 * regardless of how the source token paths are cased.
 *
 * @example
 *   variableName: (path) => `ds-${kebabCase(path.replaceAll(".", "-"))}`
 *   // color.brandPrimary → --ds-color-brand-primary
 */
export function kebabCase(str: string): string {
    return str
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z])(?=[a-z])/g, "$1-$2")
        .toLowerCase();
}
