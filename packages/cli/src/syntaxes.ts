import { extname } from "pathe";
import postcss, { type Parser } from "postcss";
import htmlSyntax from "postcss-html";

const PARSERS: Record<string, Parser> = {
    ".css": postcss.parse,
    ".html": htmlSyntax.parse as Parser,
    ".htm": htmlSyntax.parse as Parser,
    ".vue": htmlSyntax.parse as Parser,
    ".svelte": htmlSyntax.parse as Parser,
    ".astro": htmlSyntax.parse as Parser,
    ".php": htmlSyntax.parse as Parser,
};

export const STYLESHEET_EXTENSIONS = Object.keys(PARSERS);

export function parserFor(file: string): Parser | undefined {
    return PARSERS[extname(file).toLowerCase()];
}
