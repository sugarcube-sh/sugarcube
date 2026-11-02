import type { CSSBlock } from "./blocks.js";

/**
 * The blocks as a stylesheet: each that writes anything as a rule, inside its at-rules, with its
 * `@supports` alternatives after it, grouped by condition; `""` when none writes anything.
 *
 * @example
 * cssText(cssBlocks([{ declarations, selector: ":root" }]))
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
