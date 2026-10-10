import postcss, { type Parser } from "postcss";
import valueParser from "postcss-value-parser";

export interface VarRef {
    name: string;
    line: number;
    file: string;
    hasFallback?: boolean;
}

export interface ScanResult {
    declared: Set<string>;
    used: VarRef[];
}

export function scanCSS(css: string, file: string, parse: Parser = postcss.parse): ScanResult {
    const declared = new Set<string>();
    const used: VarRef[] = [];

    parse(css, { from: file }).walkDecls((decl) => {
        if (decl.prop.startsWith("--")) {
            declared.add(decl.prop);
        }

        const value = decl.value;
        const valueStartLine =
            (decl.source?.start?.line ?? 0) + countNewlines(decl.raws.between ?? "");

        valueParser(value).walk((node) => {
            if (node.type !== "function" || node.value.toLowerCase() !== "var") return;

            const nameNode = node.nodes.find((n) => n.type === "word" && n.value.startsWith("--"));
            if (!nameNode) return;

            const hasFallback = node.nodes.some((n) => n.type === "div" && n.value === ",");
            const newlinesBefore = countNewlines(value.slice(0, nameNode.sourceIndex));

            used.push({
                name: nameNode.value,
                line: valueStartLine + newlinesBefore,
                file,
                hasFallback,
            });
        });
    });

    return { declared, used };
}

function countNewlines(text: string): number {
    let count = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === "\n") count++;
    }
    return count;
}
