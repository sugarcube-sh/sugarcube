import { ErrorMessages } from "../constants/error-messages.js";
import { isTypographyToken } from "../guards/token-guards.js";
import type { InternalConfig, Permutation } from "../types/config.js";
import type {
    ConvertedToken,
    ConvertedTokens,
    NormalizedConvertedTokens,
} from "../types/convert.js";
import type {
    CSSFeatureBlock,
    CSSFileOutput,
    CSSGenerationResult,
    CSSVarSet,
    CSSVariable,
} from "../types/generate.js";
import type { TokenType } from "../types/tokens.js";

import { deterministicEntries } from "../utils/deterministic-entries.js";
import { formatCSSVarName } from "../utils/format-css-var-name.js";
import { toKebabCase } from "../utils/to-kebab-case.js";

function indentCSS(css: string, spaces = 4): string {
    const indent = " ".repeat(spaces);
    return css
        .split("\n")
        .map((line) => (line.trim() ? `${indent}${line}` : line))
        .join("\n");
}

// Converts token references like "{color.primary}" to CSS variable syntax
// Preserves numbers as-is since they're valid CSS values (e.g. for font weights)
function convertReferenceToCSSVar(value: unknown): string | number {
    if (typeof value === "number") {
        return value;
    }

    if (typeof value !== "string") {
        throw new Error(ErrorMessages.GENERATE.INVALID_CSS_VALUE_TYPE(typeof value));
    }

    return value.replace(/\{([^}]+)\}/g, (_, ref) => {
        const varName = ref.split(".").map(toKebabCase).join("-");
        return `var(--${varName})`;
    });
}

function generateSingleVariable(token: ConvertedToken<TokenType>): CSSVariable | undefined {
    const props = token.$cssProperties;
    if (!("value" in props)) {
        return undefined;
    }

    return {
        name: `--${formatCSSVarName(token.$path)}`,
        value: convertReferenceToCSSVar(props.value),
    };
}

function generateTypographyVariables(token: ConvertedToken<"typography">): CSSVariable[] {
    return Object.entries(token.$cssProperties)
        .filter(([_, value]) => value !== undefined)
        .map(([prop, value]) => ({
            name: `--${formatCSSVarName(token.$path)}-${prop}`,
            value: convertReferenceToCSSVar(value),
        }));
}

// Color tokens can have enhanced values for displays that support modern color spaces
// This function extracts those enhanced values and creates CSS variables that will only be used
// when the display supports the specific color space
function generateFeatureVariables(token: ConvertedToken<TokenType>): CSSFeatureBlock[] {
    if (token.$type !== "color") return [];

    const props = token.$cssProperties;
    if (!("featureValues" in props)) return [];

    const queryGroups = new Map<string, CSSVariable[]>();

    for (const feature of props.featureValues || []) {
        if (!queryGroups.has(feature.query)) {
            queryGroups.set(feature.query, []);
        }
        const vars = queryGroups.get(feature.query);
        if (vars) {
            vars.push({
                name: `--${formatCSSVarName(token.$path)}`,
                value: convertReferenceToCSSVar(feature.value),
            });
        }
    }

    return Array.from(queryGroups.entries()).map(([query, vars]) => ({
        query,
        vars,
    }));
}

function normalizeSelector(selector: string | string[]): string {
    if (Array.isArray(selector)) {
        return selector.join(",\n");
    }
    return selector;
}

// Generates a CSS block with proper formatting and indentation
function generateCSSBlock(block: { selector: string | string[]; vars: CSSVariable[] }): string {
    const selectorStr = normalizeSelector(block.selector);
    const parts = [`${selectorStr} {`];

    if (block.vars.length > 0) {
        const declarations = block.vars.map((v) => `    ${v.name}: ${v.value};`).join("\n");
        parts.push(declarations);
    }

    parts.push("}");

    return parts.join("\n");
}

function generateVariablesForToken<T extends TokenType>(token: ConvertedToken<T>): CSSVarSet {
    if (isTypographyToken(token)) {
        return {
            vars: generateTypographyVariables(token),
            features: generateFeatureVariables(token),
        };
    }

    const mainVar = generateSingleVariable(token);
    return {
        vars: mainVar ? [mainVar] : [],
        features: generateFeatureVariables(token),
    };
}

/**
 * Generate CSS variables for a set of converted tokens.
 */
function generateVariablesFromTokens(tokens: ConvertedTokens): {
    vars: CSSVariable[];
    features: CSSFeatureBlock[];
} {
    const varSets = deterministicEntries(tokens)
        .filter(([key, token]) => key !== "$extensions" && "$type" in token)
        .map(([_, token]) => generateVariablesForToken(token as ConvertedToken<TokenType>));

    const vars = varSets.flatMap((set) => set.vars);

    const allFeatures = varSets.flatMap((set) => set.features || []);
    const mergedFeatures = new Map<string, CSSVariable[]>();

    for (const feature of allFeatures) {
        if (!mergedFeatures.has(feature.query)) {
            mergedFeatures.set(feature.query, []);
        }
        const featureVars = mergedFeatures.get(feature.query);
        if (featureVars) {
            featureVars.push(...feature.vars);
        }
    }

    const features = Array.from(mergedFeatures.entries()).map(([query, featureVars]) => ({
        query,
        vars: featureVars,
    }));

    return { vars, features };
}

function generateCSSForPermutation(
    perm: Permutation,
    vars: CSSVariable[],
    features: CSSFeatureBlock[]
): string {
    if (vars.length === 0 && features.length === 0) {
        return "";
    }

    const blocks: string[] = [];

    // Main variables block
    if (vars.length > 0) {
        blocks.push(generateCSSBlock({ selector: perm.selector, vars }));
    }

    // Feature blocks (e.g., color-gamut queries)
    for (const feature of features) {
        const featureBlock = generateCSSBlock({ selector: perm.selector, vars: feature.vars });
        blocks.push(`${feature.query} {\n${indentCSS(featureBlock)}\n}`);
    }

    let css = blocks.join("\n\n");

    // Wrap in atRule if specified
    if (perm.atRule) {
        css = `${perm.atRule} {\n${indentCSS(css)}\n}`;
    }

    return css;
}

/**
 * Compute the delta between two sets of CSS variables.
 * Returns only variables whose values differ from the base set.
 */
function deltaVars(vars: CSSVariable[], baseVars: CSSVariable[]): CSSVariable[] {
    const baseMap = new Map(baseVars.map((v) => [v.name, v.value]));
    return vars.filter((v) => {
        const baseValue = baseMap.get(v.name);
        return baseValue === undefined || baseValue !== v.value;
    });
}

/**
 * Generates CSS variable files from normalized and converted design tokens.
 *
 * Tokens are keyed by "perm:{index}" — each permutation was resolved independently
 * by the loading pipeline. This function looks up tokens by index, generates CSS
 * variables, and wraps each in its permutation's selector.
 *
 * For multi-permutation output, non-first permutations are delta-optimized:
 * only variables that differ from the first permutation are output.
 *
 * Permutations are always on config.variables.permutations — either defined by the
 * user or auto-generated from modifier metadata by the loading pipeline.
 */
export async function generate(
    tokens: NormalizedConvertedTokens,
    config: InternalConfig
): Promise<CSSGenerationResult> {
    const permutations = config.variables.permutations;

    if (!permutations || permutations.length === 0) {
        return { output: [] };
    }

    const byPath = new Map<string, { perm: Permutation; css: string }[]>();

    // Track base vars per output path for delta optimisation
    const baseVarsByPath = new Map<string, CSSVariable[]>();

    for (let i = 0; i < permutations.length; i++) {
        const perm = permutations[i];
        if (!perm) continue;
        const contextTokens = tokens[`perm:${i}`];

        if (!contextTokens || Object.keys(contextTokens).length === 0) {
            continue;
        }

        const outputPath = perm.path ?? config.variables.path;
        let { vars, features } = generateVariablesFromTokens(contextTokens);

        // Delta optimization: for non-first permutations in the same output file,
        // only include variables that differ from the first permutation in that file
        if (baseVarsByPath.has(outputPath)) {
            vars = deltaVars(vars, baseVarsByPath.get(outputPath) ?? []);
        } else {
            baseVarsByPath.set(outputPath, vars);
        }

        const css = generateCSSForPermutation(perm, vars, features);

        if (css.trim()) {
            if (!byPath.has(outputPath)) {
                byPath.set(outputPath, []);
            }
            byPath.get(outputPath)?.push({ perm, css });
        }
    }

    const output: CSSFileOutput = [];

    for (const [path, chunks] of byPath) {
        output.push({
            path,
            css: `${chunks
                .map((c) => c.css)
                .join("\n\n")
                .trim()}\n`,
        });
    }

    return { output };
}
