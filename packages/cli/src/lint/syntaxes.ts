import { extname } from "pathe";
import postcss, { type Parser } from "postcss";
import htmlSyntax from "postcss-html";

const SYNTAX_PARSERS: Record<string, Parser> = {
    ".css": postcss.parse,
    ".html": htmlSyntax.parse as Parser,
    ".vue": htmlSyntax.parse as Parser,
    ".svelte": htmlSyntax.parse as Parser,
    ".astro": htmlSyntax.parse as Parser,
    ".php": htmlSyntax.parse as Parser,
};

export type Resolution = { kind: "parser"; parse: Parser } | { kind: "unsupported"; ext: string };

export interface SyntaxResolver {
    resolve(file: string): Resolution;
    extensions(): string[];
}

export function createSyntaxResolver(): SyntaxResolver {
    return {
        resolve(file) {
            const ext = extname(file).toLowerCase();
            const parse = SYNTAX_PARSERS[ext];
            return parse ? { kind: "parser", parse } : { kind: "unsupported", ext };
        },
        extensions() {
            return Object.keys(SYNTAX_PARSERS);
        },
    };
}
