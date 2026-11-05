import type { CSSBlock } from "./blocks.js";

/**
 * Writes blocks as a stylesheet.
 *
 * A block with nothing to write is left out. If no block writes anything, it returns `""`.
 *
 * @param blocks - The blocks, from {@link getCSSBlocks}.
 *
 * @example
 * // The default permutation under :root
 * toCSS(getCSSBlocks(tokens, [{ input: {}, selector: ":root" }]))
 * // =>
 * // :root {
 * //     --color-blue-500: rgb(51 102 204);
 * //     --color-blue-300: rgb(102 153 255);
 * //     --color-primary: var(--color-blue-500);
 * //     --button-background: var(--color-primary);
 * // }
 */
export function toCSS(blocks: readonly CSSBlock[]): string {
    const rules = blocks
        .filter(({ inRule, underSupports }) => inRule.length > 0 || underSupports.length > 0)
        .map(text);
    return rules.length === 0 ? "" : `${rules.join("\n\n")}\n`;
}

function text({ selector, atRules = [], inRule, underSupports }: CSSBlock): string {
    const rule = (lines: readonly { name: string; value: string }[]) => {
        const written = lines.map(({ name, value }) => `    ${name}: ${value};`);
        return `${[selector].flat().join(",\n")} {\n${written.join("\n")}\n}`;
    };
    const conditions = new Map<string, { name: string; value: string }[]>();
    for (const { name, supports = [] } of underSupports) {
        for (const { condition, value } of supports) {
            const lines = conditions.get(condition) ?? [];
            lines.push({ name, value });
            conditions.set(condition, lines);
        }
    }
    const css = [
        ...(inRule.length > 0 ? [rule(inRule)] : []),
        ...[...conditions].map(
            ([condition, lines]) => `@supports ${condition} {\n${indent(rule(lines))}\n}`,
        ),
    ].join("\n\n");
    return atRules.reduceRight((inner, atRule) => `${atRule} {\n${indent(inner)}\n}`, css);
}

function indent(css: string): string {
    return css
        .split("\n")
        .map((line) => (line ? `    ${line}` : line))
        .join("\n");
}
