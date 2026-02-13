import { isTypographyToken } from "../guards/token-guards.js";
import type { InternalConfig } from "../types/config.js";
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
    CSSVariableBlocks,
    SingleFileOutput,
} from "../types/generate.js";
import type { ModifierMeta } from "../types/pipelines.js";
import type { TokenType } from "../types/tokens.js";

import { deterministicEntries } from "../utils/deterministic-entries.js";
import { toKebabCase } from "../utils/to-kebab-case.js";

function formatCSSVarPath(path: string): string {
    return path.split(".").join("-");
}

// Converts token references like "{color.primary}" to CSS variable syntax
// Preserves numbers as-is since they're valid CSS values (e.g. for font weights)
function convertReferenceToCSSVar(value: unknown): string | number {
    if (typeof value === "number") {
        return value;
    }

    if (typeof value !== "string") {
        console.warn("[sugarcube] Unexpected value type in convertReferenceToCSSVar:", value);
        return String(value);
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
        name: `--${formatCSSVarPath(token.$path)}`,
        value: convertReferenceToCSSVar(props.value),
    };
}

function generateTypographyVariables(token: ConvertedToken<"typography">): CSSVariable[] {
    return Object.entries(token.$cssProperties)
        .filter(([_, value]) => value !== undefined)
        .map(([prop, value]) => ({
            name: `--${formatCSSVarPath(token.$path)}-${prop}`,
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
                name: `--${formatCSSVarPath(token.$path)}`,
                value: convertReferenceToCSSVar(feature.value),
            });
        }
    }

    return Array.from(queryGroups.entries()).map(([query, vars]) => ({
        query,
        vars,
    }));
}

// Generates a CSS block with proper formatting and indentation
// Handles both the root variables and any feature-specific variables (like P3 colors)
// Optionally includes a comment to document the block's purpose
function generateCSSBlock(block: {
    selector: string;
    vars: CSSVariable[];
    comment?: string;
}): string {
    const parts = [`${block.selector} {`];

    if (block.comment) {
        parts.push(`    /* ${block.comment} */`);
    }

    if (block.vars.length > 0) {
        const declarations = block.vars.map((v) => `    ${v.name}: ${v.value};`).join("\n");
        parts.push(declarations);
    }

    parts.push("}");

    return parts.join("\n");
}

function convertCSSVarsToString(css: CSSVariableBlocks): string {
    const blocks: string[] = [];

    if (css.root.vars.length > 0) {
        blocks.push(
            generateCSSBlock({
                selector: css.root.selector,
                vars: css.root.vars,
            })
        );
    }

    for (const feature of css.features) {
        const featureBlock = generateCSSBlock({
            selector: css.root.selector,
            vars: feature.vars,
        });

        const indentedBlock = featureBlock
            .split("\n")
            .map((line) => `    ${line}`)
            .join("\n");

        blocks.push(`${feature.query} {\n${indentedBlock}\n}`);
    }

    return blocks.filter(Boolean).join("\n\n");
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
 * Builds a CSS selector based on context.
 *
 * Context can be:
 * - undefined/"default" → :root
 * - Compound key "modifierName:contextName" → [data-modifierName="contextName"]
 * - Simple key "contextName" → [data-theme="contextName"]
 *
 * @param context - The context key (may be compound like "theme:dark")
 * @param modifiers - Optional modifier metadata for attribute lookup
 * @param config - Config for fallback themeAttribute
 */
function buildSelector(
    context: string,
    modifiers: ModifierMeta[] | undefined,
    config: InternalConfig
): string {
    // Default context uses :root
    if (!context || context === "default") {
        return ":root";
    }

    // Check for compound key format: "modifierName:contextName"
    const colonIndex = context.indexOf(":");
    if (colonIndex !== -1) {
        const modifierName = context.slice(0, colonIndex);
        const contextName = context.slice(colonIndex + 1);

        // Find the modifier to get its attribute
        const modifier = modifiers?.find((m) => m.name === modifierName);
        const attribute = modifier?.attribute ?? `data-${modifierName}`;

        return `[${attribute}="${contextName}"]`;
    }

    // Legacy: simple context name, use config.themeAttribute
    // TODO: safe to delete this?
    return `[${config.output.themeAttribute}="${context}"]`;
}

async function generateCSS(
    tokens: ConvertedTokens,
    config: InternalConfig,
    metadata: {
        context: string;
        modifiers?: ModifierMeta[];
    }
): Promise<{ output: SingleFileOutput }> {
    const varSets = deterministicEntries(tokens)
        .filter(([key, token]) => key !== "$extensions" && "$type" in token)
        .map(([_, token]) => generateVariablesForToken(token as ConvertedToken<TokenType>));

    const selector = buildSelector(metadata.context, metadata.modifiers, config);

    const rootVars = varSets.flatMap((set) => set.vars);

    const allFeatures = varSets.flatMap((set) => set.features || []);

    const mergedFeatures = new Map<string, CSSVariable[]>();
    for (const feature of allFeatures) {
        if (!mergedFeatures.has(feature.query)) {
            mergedFeatures.set(feature.query, []);
        }
        const vars = mergedFeatures.get(feature.query);
        if (vars) {
            vars.push(...feature.vars);
        }
    }

    const mergedFeatureBlocks = Array.from(mergedFeatures.entries()).map(([query, vars]) => ({
        query,
        vars,
    }));

    const css = convertCSSVarsToString({
        root: { selector, vars: rootVars },
        features: mergedFeatureBlocks,
    });

    if (!css.trim()) {
        return {
            output: [
                {
                    path: config.output.variablesFilename,
                    css: "",
                },
            ],
        };
    }

    return {
        output: [
            {
                path: config.output.variablesFilename,
                css: formatCSSVars(css),
            },
        ],
    };
}

function formatCSSVars(css: string): string {
    return css.endsWith("\n") ? css : `${css}\n`;
}

async function generateSingleFile(
    tokens: NormalizedConvertedTokens,
    config: InternalConfig,
    modifiers?: ModifierMeta[]
): Promise<CSSFileOutput> {
    const variablesDir = config.output.variables;
    const cssChunks: string[] = [];

    // Sort contexts for deterministic output, with default context first
    const sortedContexts = Object.entries(tokens).sort(([a], [b]) => {
        if (!a || a === "default") return -1;
        if (!b || b === "default") return 1;
        return a.localeCompare(b);
    });

    for (const [context, contextTokens] of sortedContexts) {
        const result = await generateCSS(contextTokens, config, {
            context,
            modifiers,
        });

        if (result.output[0].css.trim()) {
            cssChunks.push(result.output[0].css);
        }
    }

    if (cssChunks.length === 0) {
        return [];
    }

    return [
        {
            path: `${variablesDir}/${config.output.variablesFilename}`,
            css: `${cssChunks.filter(Boolean).join("\n").trim()}\n`,
        },
    ];
}

/**
 * Generates CSS variable files from normalized and converted design tokens.
 *
 * @param tokens - The normalized and converted design tokens to generate CSS from
 * @param config - The configuration object that controls output behavior
 * @param modifiers - Optional modifier metadata for generating per-modifier attribute selectors
 * @returns A promise that resolves to the CSS generation result containing all output files
 *
 * All contexts are combined into a single 'tokens.variables.gen.css' file.
 *
 * Selector generation:
 * - Default context (undefined or "default"): `:root`
 * - Compound context "modifierName:contextName": `[data-modifierName="contextName"]`
 * - Simple context "contextName": `[data-theme="contextName"]` (legacy, uses config.themeAttribute)
 */
export async function generate(
    tokens: NormalizedConvertedTokens,
    config: InternalConfig,
    modifiers?: ModifierMeta[]
): Promise<CSSGenerationResult> {
    // Filter out empty contexts firsts, otherwise we'll get an empty file
    const filteredTokens: NormalizedConvertedTokens = {};

    for (const [context, contextTokens] of Object.entries(tokens)) {
        if (Object.keys(contextTokens).length > 0) {
            filteredTokens[context] = contextTokens;
        }
    }

    return { output: await generateSingleFile(filteredTokens, config, modifiers) };
}
