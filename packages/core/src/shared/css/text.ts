import type { CSSFileOutput } from "../../types/generate.js";
import type { Block } from "./blocks.js";

export function files(byFile: Map<string, Block[]>): CSSFileOutput {
    return [...byFile].flatMap(([path, blocks]) => {
        const rules = blocks
            .filter(({ written, supported }) => written.length > 0 || supported.length > 0)
            .map(text);
        return rules.length > 0 ? [{ path, css: `${rules.join("\n\n")}\n` }] : [];
    });
}

function text({ entry: { selector, atRule }, written, supported }: Block): string {
    const rule = (lines: { name: string; value: string }[]) => {
        const declared = lines.map(({ name, value }) => `    ${name}: ${value};`);
        return `${[selector].flat().join(",\n")} {\n${declared.join("\n")}\n}`;
    };
    const conditions = new Map<string, { name: string; value: string }[]>();
    for (const { name, supports } of supported) {
        const lines = conditions.get(supports.condition) ?? [];
        lines.push({ name, value: supports.value });
        conditions.set(supports.condition, lines);
    }
    const css = [
        ...(written.length > 0 ? [rule(written)] : []),
        ...[...conditions].map(
            ([condition, lines]) => `@supports ${condition} {\n${indent(rule(lines))}\n}`,
        ),
    ].join("\n\n");
    return atRule ? `${atRule} {\n${indent(css)}\n}` : css;
}

function indent(css: string): string {
    return css
        .split("\n")
        .map((line) => (line ? `    ${line}` : line))
        .join("\n");
}
