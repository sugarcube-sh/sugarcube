import { extname } from "pathe";
import postcss, { type Parser } from "postcss";

export const DEFAULT_SYNTAXES: Record<string, string> = {
    ".html": "postcss-html",
    ".vue": "postcss-html",
    ".svelte": "postcss-html",
    ".astro": "postcss-html",
    ".php": "postcss-html",
};

const PLAIN_CSS = ".css";

export type Resolution =
    | { kind: "parser"; parse: Parser }
    | { kind: "missing"; module: string }
    | { kind: "unsupported"; ext: string };

export interface SyntaxResolver {
    resolve(file: string): Promise<Resolution>;
    extensions(): string[];
}

export function createSyntaxResolver(overrides: Record<string, string> = {}): SyntaxResolver {
    const syntaxes = { ...DEFAULT_SYNTAXES, ...overrides };
    const loaded = new Map<string, Parser | null>();

    async function load(module: string): Promise<Parser | null> {
        const cached = loaded.get(module);
        if (cached !== undefined) return cached;

        let parse: Parser | null = null;
        try {
            const mod = await import(module);
            const candidate = mod.default ?? mod;
            const syntax = typeof candidate === "function" ? candidate() : candidate;
            parse = (syntax.parse as Parser) ?? null;
        } catch {
            parse = null;
        }

        loaded.set(module, parse);
        return parse;
    }

    return {
        async resolve(file) {
            const ext = extname(file).toLowerCase();
            if (ext === PLAIN_CSS) return { kind: "parser", parse: postcss.parse };

            const module = syntaxes[ext];
            if (!module) return { kind: "unsupported", ext };

            const parse = await load(module);
            return parse ? { kind: "parser", parse } : { kind: "missing", module };
        },
        extensions() {
            return [PLAIN_CSS, ...Object.keys(syntaxes)];
        },
    };
}
