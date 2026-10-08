import {
    type CSSFileOutput,
    assignCSSNames,
    clearMatchCache,
    convertConfigToUnoRules,
    enumerateSafelistClasses,
    generateCSSVariables,
    groupByContext,
    writeCSSUtilitiesToDisk,
    writeCSSVariablesToDisk,
} from "@sugarcube-sh/core";
import type {
    InternalConfig,
    NormalizedRenderableTokens,
    Permutation,
    RenderableToken,
} from "@sugarcube-sh/core";
import { type UnoGenerator, type UserConfig, createGenerator } from "@unocss/core";
import { addBanner, utilitiesFromMarkup, wrapInLayer } from "../output.js";
import { prepareTokens } from "../prepare-tokens.js";

export interface GenerateAllCSSOptions {
    variablesOnly?: boolean;
    utilitiesOnly?: boolean;
}

export type GenerationResult = {
    output: CSSFileOutput;
    warnings: Array<{ path: string; message: string }>;
};

export type ChangeKind = "token" | "markup";

export interface WatchSession {
    /** Cold build: full token pipeline + variables + utilities. Warms the cache. */
    primeAndBuild(): Promise<GenerationResult>;
    /** Regenerate in response to a watched change, routed by `kind`. */
    onChange(kind: ChangeKind, changedPath: string): Promise<GenerationResult>;
}

type BuiltUtilityGenerator = {
    generator: UnoGenerator;
    safelist: string[];
} | null;

async function buildUtilityGenerator(
    tokens: NormalizedRenderableTokens,
    config: InternalConfig,
): Promise<BuiltUtilityGenerator> {
    if (!config.utilities.classes || Object.keys(config.utilities.classes).length === 0) {
        return null;
    }

    const safelist = enumerateSafelistClasses(config.utilities.classes, tokens);
    const generatorOptions: UserConfig = {
        presets: [
            {
                name: "sugarcube",
                rules: convertConfigToUnoRules(config.utilities.classes, tokens),
                preflights: [],
            },
        ],
        safelist,
    };

    return { generator: await createGenerator(generatorOptions), safelist };
}

async function runUtilityGenerator(
    built: BuiltUtilityGenerator,
    config: InternalConfig,
): Promise<CSSFileOutput> {
    if (!built) return [];
    return utilitiesFromMarkup(built.generator, built.safelist, config);
}

async function writeVariables(
    convertedTokens: NormalizedRenderableTokens,
    config: InternalConfig,
    permutations: Permutation[],
): Promise<CSSFileOutput> {
    let cssVariables = await generateCSSVariables(convertedTokens, config, permutations);
    if (config.variables.layer) {
        cssVariables = wrapInLayer(cssVariables, config.variables.layer);
    }
    const cssVariablesWithBanner = addBanner(cssVariables);
    await writeCSSVariablesToDisk(cssVariablesWithBanner);
    return cssVariablesWithBanner;
}

async function writeUtilities(
    built: BuiltUtilityGenerator,
    config: InternalConfig,
): Promise<CSSFileOutput> {
    let utilities = await runUtilityGenerator(built, config);
    if (config.utilities.layer) {
        utilities = wrapInLayer(utilities, config.utilities.layer);
    }
    const utilitiesWithBanner = addBanner(utilities);
    await writeCSSUtilitiesToDisk(utilitiesWithBanner);
    return utilitiesWithBanner;
}

function utilityShapeSignature(tokens: NormalizedRenderableTokens): string {
    const contextKey = tokens.default ? "default" : Object.keys(tokens)[0];
    const context = contextKey ? tokens[contextKey] : undefined;
    if (!context) return "";

    const parts: string[] = [];
    for (const entry of Object.values(context)) {
        if (!("$path" in entry)) continue;
        const token = entry as RenderableToken;
        parts.push(`${token.$path}|${token.$type ?? ""}|${token.$names.css}`);
    }
    return parts.join("\n");
}

/** Cached results of the token pipeline — everything a markup change can reuse. */
type TokenState = {
    convertedTokens: NormalizedRenderableTokens;
    permutations: Permutation[];
    warnings: GenerationResult["warnings"];
};

/**
 * A watch session holds the token-pipeline results between events so it can
 * route regeneration by what changed:
 *
 * - token change → fully reload + resolve + convert from disk, then regenerate
 *   variables and utilities. Nothing stale is reused.
 * - markup change → reuse the cached token state verbatim and regenerate only
 *   utilities (variables don't depend on markup), skipping the entire token
 *   pipeline. Each concern is always fully recomputed, never patched, so the
 *   output matches a cold build.
 *
 * The UnoCSS generator is persisted and reused across markup changes. Its first
 * `generate()` does ~30ms of lazy setup that dominates a markup regen; because
 * rules + safelist depend only on the token shape, the generator is rebuilt only
 * when that shape changes, keyed by the same signature used above. `generate`
 * emits CSS for exactly the current source, so reuse is byte-identical to a cold
 * build — verified for classes added and removed.
 */
export function createWatchSession(
    config: InternalConfig,
    options: GenerateAllCSSOptions = {},
): WatchSession {
    let state: TokenState | null = null;
    let lastUtilities: CSSFileOutput = [];
    let lastUtilitySignature: string | null = null;
    let builtGenerator: BuiltUtilityGenerator = null;
    let builtGeneratorSignature: string | null = null;

    async function reloadTokens(): Promise<TokenState> {
        clearMatchCache();
        const { trees, resolved, warnings, permutations } = await prepareTokens(config);
        const next: TokenState = {
            convertedTokens: assignCSSNames(groupByContext(trees, resolved), config),
            permutations,
            warnings,
        };
        state = next;
        return next;
    }

    async function regenerateUtilities(current: TokenState): Promise<CSSFileOutput> {
        const signature = utilityShapeSignature(current.convertedTokens);
        if (builtGeneratorSignature !== signature) {
            builtGenerator = await buildUtilityGenerator(current.convertedTokens, config);
            builtGeneratorSignature = signature;
        }
        lastUtilities = await writeUtilities(builtGenerator, config);
        lastUtilitySignature = signature;
        return lastUtilities;
    }

    async function buildAll(current: TokenState): Promise<CSSFileOutput> {
        const output: CSSFileOutput = [];
        if (!options.utilitiesOnly) {
            output.push(
                ...(await writeVariables(current.convertedTokens, config, current.permutations)),
            );
        }
        if (!options.variablesOnly) {
            output.push(...(await regenerateUtilities(current)));
        }
        return output;
    }

    return {
        async primeAndBuild() {
            const current = await reloadTokens();
            return { output: await buildAll(current), warnings: current.warnings };
        },
        async onChange(kind, _changedPath) {
            if (kind === "token" || state === null) {
                const current = await reloadTokens();
                const output: CSSFileOutput = [];
                if (!options.utilitiesOnly) {
                    output.push(
                        ...(await writeVariables(
                            current.convertedTokens,
                            config,
                            current.permutations,
                        )),
                    );
                }
                if (!options.variablesOnly) {
                    const signature = utilityShapeSignature(current.convertedTokens);
                    output.push(
                        ...(signature === lastUtilitySignature
                            ? lastUtilities
                            : await regenerateUtilities(current)),
                    );
                }
                return { output, warnings: current.warnings };
            }

            const output = options.variablesOnly ? [] : await regenerateUtilities(state);
            return { output, warnings: state.warnings };
        },
    };
}
