import {
    type DesignTokens,
    type Input,
    type Permutation,
    PermutationError,
    type Token,
} from "@sugarcube-sh/dtcg";
import { type CSSDeclarations, type CSSWriter, createCSSWriter } from "@sugarcube-sh/dtcg/css";
import type { PermutationConfig, InternalConfig } from "../../types/config.js";
import type { AnyDiagnostic } from "../../types/diagnostics.js";
import {
    type TokenProblem,
    createTokenProblem,
    createDiagnostic,
    locateProblems,
} from "../diagnostics.js";
import { findFallbacks } from "./polyfill.js";
import { findTextZoomProblems } from "./text-zoom.js";
import { createCSSWriterOptions } from "./writer-options.js";

export interface DeclaredPermutation {
    permutation: Permutation;
    input: Input;
    selector: string | readonly string[];
    atRule?: string;
    path: string;
    declared: CSSDeclarations;
}

/**
 * The CSS variables each permutation in the config declares.
 *
 * `entries` are in the config's order, with each one's selector and file.
 * `diagnostics` has the problems from reading the tokens and from declaring the variables.
 */
export interface Declarations {
    tokens: DesignTokens;
    writer: CSSWriter;
    entries: DeclaredPermutation[];
    diagnostics: AnyDiagnostic[];
}

/**
 * Finds the CSS variables each permutation in the config declares.
 *
 * Both `emitCSS` and `getUtilityTokens` use the result.
 * A modifier with no default and no `permutations` in the config declares nothing.
 *
 * @param tokens - The design tokens read with `createReadOptions`.
 * @param config - The config with its defaults.
 *
 * @example
 * declare(tokens, config).entries.map(({ selector }) => selector)
 * // => [":root", '[data-mode="dark"]']
 */
export function declare(tokens: DesignTokens, config: InternalConfig): Declarations {
    const polyfill = config.variables.transforms.colorFallbackStrategy === "polyfill";
    const deprecated = polyfill
        ? [createDiagnostic("option-deprecated", { option: 'colorFallbackStrategy: "polyfill"' })]
        : [];
    const options = createCSSWriterOptions(tokens, config);
    const writer = createCSSWriter(options);
    const configured = config.variables.permutations ?? [];
    const required = configured.length === 0 ? findDefaultRequired(tokens) : undefined;
    if (required) {
        return {
            tokens,
            writer,
            entries: [],
            diagnostics: [...tokens.diagnostics, required, ...deprecated],
        };
    }

    const entries = getDeclaredPermutations(tokens, config, configured, writer);
    const permutations = [...new Set(entries.map(({ permutation }) => permutation))];
    const declarations = permutations.map((permutation) => writer.getDeclarations(permutation));

    return {
        tokens,
        writer,
        entries: entries,
        diagnostics: [
            ...tokens.diagnostics,
            ...deprecated,
            ...findDefaultsNotFirst(entries),
            ...locateProblems(tokens, [
                ...findTextZoomProblems(
                    permutations,
                    config.variables.transforms.fluid,
                    tokens.parseOptions,
                ),
                ...(polyfill ? findMissingHex(declarations, options.skip) : []),
                ...findSameVariableNames(declarations),
            ]),
        ],
    };
}

function getDeclaredPermutations(
    tokens: DesignTokens,
    config: InternalConfig,
    configured: readonly PermutationConfig[],
    writer: CSSWriter,
): DeclaredPermutation[] {
    if (configured.length === 0) {
        const base = tokens.permutations.filter(({ isDefault }) => isDefault);
        const overrides = tokens.permutations.filter(({ isDefault }) => !isDefault);
        return [...base, ...overrides].map((permutation) => {
            const input = getChangedInput(permutation);
            return {
                permutation,
                selector: toSelector(input),
                input,
                path: config.variables.path,
                declared: writer.getDeclarations(permutation),
            };
        });
    }
    return configured.flatMap(({ input, selector, atRule, path }) => {
        const permutation = findPermutation(tokens, input);
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

function findDefaultsNotFirst(toWrite: DeclaredPermutation[]): AnyDiagnostic[] {
    return [...new Set(toWrite.map(({ path }) => path))].flatMap((file) => {
        const fileEntries = toWrite.filter(({ path }) => path === file);
        const [first] = fileEntries;
        const base = fileEntries.find(({ permutation }) => permutation.isDefault);
        if (!first || !base || base === first) return [];
        const selector = formatSelector(base.selector);
        const after = formatSelector(first.selector);
        return [createDiagnostic("default-not-first", { file, selector, after })];
    });
}

function formatSelector(selector: string | readonly string[]): string {
    return typeof selector === "string" ? selector : selector.join(", ");
}

function findPermutation(tokens: DesignTokens, input: Input): Permutation | undefined {
    try {
        return tokens.getPermutation(input);
    } catch (error) {
        if (error instanceof PermutationError) return undefined;
        throw error;
    }
}

function getChangedInput(permutation: Permutation): Input {
    return Object.fromEntries(
        permutation.contexts
            .filter((context) => !context.isDefault)
            .map((context) => [context.modifier.name, context.name]),
    );
}

function toSelector(input: Input): string {
    const [changed] = Object.entries(input);
    return changed ? `[data-${changed[0]}="${changed[1]}"]` : ":root";
}

function findDefaultRequired(tokens: DesignTokens): AnyDiagnostic | undefined {
    const withoutDefault = (tokens.resolver?.modifiers ?? []).filter(
        (modifier) => modifier.default === undefined,
    );
    const [first] = withoutDefault;
    if (!first) return undefined;
    return {
        ...createDiagnostic("default-required", {
            modifiers: withoutDefault.map(({ name }) => name),
        }),
        span: first.span,
    };
}

function findMissingHex(
    declared: CSSDeclarations[],
    skip: (token: Token) => boolean,
): TokenProblem[] {
    const found = new Map<string, TokenProblem>();
    const declaredTokens = new Set(
        declared.flatMap(({ declarations }) => declarations.map(({ token }) => token)),
    );
    const missing = [...declaredTokens].flatMap((token) => findFallbacks(token, skip).missing);
    for (const { token, colorSpace } of missing) {
        const key = `${token.path}\u0000${colorSpace}`;
        if (!found.has(key))
            found.set(key, createTokenProblem(token, "fallback-missing", { colorSpace }));
    }
    return [...found.values()];
}

function findSameVariableNames(declared: CSSDeclarations[]): TokenProblem[] {
    const found = new Map<string, TokenProblem>();
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
            found.set(key, createTokenProblem(token, "same-variable-name", { name, paths }));
        }
    }
    return [...found.values()];
}
