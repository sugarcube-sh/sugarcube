import {
    type DesignTokens,
    type Input,
    type Permutation,
    PermutationError,
    type Token,
} from "@sugarcube-sh/dtcg";
import { type CSSDeclarations, type CSSWriter, createCSSWriter } from "@sugarcube-sh/dtcg/css";
import type { PermutationConfig, InternalConfig } from "../../types/config.js";
import type { Reported } from "../../types/diagnostics.js";
import { type AboutToken, aboutToken, diagnostic, located } from "../diagnostics.js";
import { fallbacksIn } from "./polyfill.js";
import { textZoomWarnings } from "./text-zoom.js";
import { cssWriterOptions } from "./writer-options.js";

export interface Entry {
    permutation: Permutation;
    input: Input;
    selector: string | string[];
    atRule?: string;
    path: string;
    declared: CSSDeclarations;
}

/**
 * Each permutation the config writes, in its order, with where it goes and what it declares (one
 * `declared` for every entry of one permutation); and every problem found reading and declaring:
 * the read's own, a deprecated `colorFallbackStrategy`, a default permutation's block written after
 * another in its file, fluid text that fails text zoom, a color with no `hex` to fall back to, and
 * two paths making one variable. With them, the design tokens declared and the writer that
 * declared them, which `emitCSS` writes the blocks with.
 */
export interface Declarations {
    tokens: DesignTokens;
    writer: CSSWriter;
    entries: Entry[];
    diagnostics: Reported[];
}

/**
 * Works out every CSS variable the config writes, once per build, for both `emitCSS` and
 * `utilityTokens`. With a modifier that has no default and no permutations listed, nothing can go
 * on `:root`, so nothing is declared.
 *
 * @example
 * const declared = declare(tokens, config);
 * const { files } = emitCSS(declared, config);
 * const { rules, safelist } = utilityRules(utilityTokens(declared), config.utilities.classes);
 */
export function declare(tokens: DesignTokens, config: InternalConfig): Declarations {
    const polyfill = config.variables.transforms.colorFallbackStrategy === "polyfill";
    const deprecated = polyfill
        ? [diagnostic("option-deprecated", { option: 'colorFallbackStrategy: "polyfill"' })]
        : [];
    const options = cssWriterOptions(tokens, config);
    const writer = createCSSWriter(options);
    const listed = config.variables.permutations ?? [];
    const required = listed.length === 0 ? defaultRequired(tokens) : undefined;
    if (required) {
        return {
            tokens,
            writer,
            entries: [],
            diagnostics: [...tokens.diagnostics, required, ...deprecated],
        };
    }

    const toWrite = entries(tokens, config, listed, writer);
    const permutations = [...new Set(toWrite.map(({ permutation }) => permutation))];
    const once = permutations.map((permutation) => writer.getDeclarations(permutation));

    return {
        tokens,
        writer,
        entries: toWrite,
        diagnostics: [
            ...tokens.diagnostics,
            ...deprecated,
            ...defaultsNotFirst(toWrite),
            ...located(tokens, [
                ...textZoomWarnings(
                    permutations,
                    config.variables.transforms.fluid,
                    tokens.parseOptions,
                ),
                ...(polyfill ? missingHex(once, options.skip) : []),
                ...sameNames(once),
            ]),
        ],
    };
}

function entries(
    tokens: DesignTokens,
    config: InternalConfig,
    listed: PermutationConfig[],
    writer: CSSWriter,
): Entry[] {
    if (listed.length === 0) {
        const base = tokens.permutations.filter(({ isDefault }) => isDefault);
        const overrides = tokens.permutations.filter(({ isDefault }) => !isDefault);
        return [...base, ...overrides].map((permutation) => {
            const input = setApart(permutation);
            return {
                permutation,
                selector: derivedSelector(input),
                input,
                path: config.variables.path,
                declared: writer.getDeclarations(permutation),
            };
        });
    }
    return listed.flatMap(({ input, selector, atRule, path }) => {
        const permutation = configured(tokens, input);
        if (!permutation) return [];
        return [
            {
                permutation,
                input,
                selector,
                path: path ?? config.variables.path,
                ...(atRule && { atRule }),
                declared: writer.getDeclarations(permutation),
            },
        ];
    });
}

function defaultsNotFirst(toWrite: Entry[]): Reported[] {
    return [...new Set(toWrite.map(({ path }) => path))].flatMap((file) => {
        const inFile = toWrite.filter(({ path }) => path === file);
        const [first] = inFile;
        const base = inFile.find(({ permutation }) => permutation.isDefault);
        if (!first || !base || base === first) return [];
        const selector = selectorText(base.selector);
        const after = selectorText(first.selector);
        return [diagnostic("default-not-first", { file, selector, after })];
    });
}

function selectorText(selector: string | string[]): string {
    return typeof selector === "string" ? selector : selector.join(", ");
}

function configured(tokens: DesignTokens, input: Input): Permutation | undefined {
    try {
        return tokens.getPermutation(input);
    } catch (error) {
        if (error instanceof PermutationError) return undefined;
        throw error;
    }
}

function setApart(permutation: Permutation): Input {
    return Object.fromEntries(
        permutation.contexts
            .filter((context) => !context.isDefault)
            .map((context) => [context.modifier.name, context.name]),
    );
}

function derivedSelector(input: Input): string {
    const [changed] = Object.entries(input);
    return changed ? `[data-${changed[0]}="${changed[1]}"]` : ":root";
}

function defaultRequired(tokens: DesignTokens): Reported | undefined {
    const withoutDefault = (tokens.resolver?.modifiers ?? []).filter(
        (modifier) => modifier.default === undefined,
    );
    const [first] = withoutDefault;
    if (!first) return undefined;
    return {
        ...diagnostic("default-required", { modifiers: withoutDefault.map(({ name }) => name) }),
        span: first.span,
    };
}

function missingHex(declared: CSSDeclarations[], skip: (token: Token) => boolean): AboutToken[] {
    const found = new Map<string, AboutToken>();
    const written = new Set(
        declared.flatMap(({ declarations }) => declarations.map(({ token }) => token)),
    );
    const missing = [...written].flatMap((token) => fallbacksIn(token, skip).missing);
    for (const { token, colorSpace } of missing) {
        const key = `${token.path}\u0000${colorSpace}`;
        if (!found.has(key)) found.set(key, aboutToken(token, "fallback-missing", { colorSpace }));
    }
    return [...found.values()];
}

function sameNames(declared: CSSDeclarations[]): AboutToken[] {
    const found = new Map<string, AboutToken>();
    for (const { declarations: lines } of declared) {
        const first = new Map<string, string>();
        for (const { name, token } of lines) {
            const earlier = first.get(name);
            if (earlier === undefined) {
                first.set(name, token.path);
                continue;
            }
            const key = `${earlier}\u0000${token.path}`;
            if (earlier === token.path || found.has(key)) continue;
            const paths: [string, string] = [earlier, token.path];
            found.set(key, aboutToken(token, "same-variable-name", { name, paths }));
        }
    }
    return [...found.values()];
}
