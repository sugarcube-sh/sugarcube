import { bench, describe } from "vitest";
import { fillDefaults } from "../../src/node/config/normalize.js";
import { loadTokens } from "../../src/node/load-tokens.js";
import { convertTokens } from "../../src/shared/convert-tokens.js";
import { expand } from "../../src/shared/pipeline/expand.js";
import { resolveTokens } from "../../src/shared/resolve-tokens.js";
import type { SugarcubeConfig } from "../../src/types/config.js";
import type { TokenMemoryData } from "../../src/types/load.js";
import type { TokenGroup, TokenTree } from "../../src/types/tokens.js";

async function runPipeline(source: Parameters<typeof loadTokens>[0]) {
    const loaded = await loadTokens(source);
    const resolved = resolveTokens(loaded.trees);
    return {
        trees: resolved.trees,
        resolved: resolved.resolved,
        errors: { load: loaded.errors, ...resolved.errors },
    };
}

function generateTokens(size: number) {
    const tokens: Record<string, unknown> = {
        colors: {},
        spacing: {},
        typography: {},
    };

    const colors = tokens.colors as Record<string, unknown>;
    const spacing = tokens.spacing as Record<string, unknown>;
    const typography = tokens.typography as Record<string, unknown>;

    for (let i = 0; i < size; i++) {
        // Color tokens (every 3rd is a base color, others reference it)
        const isBaseColor = i % 3 === 0;
        const nearestBaseColor = Math.floor(i / 3) * 3;
        colors[`color-${i}`] = {
            $value: isBaseColor ? "#ff0000" : `{colors.color-${nearestBaseColor}}`,
            $type: "color",
            $description: `Color token ${i}`,
        };

        // Spacing tokens (every 2nd is a base value)
        const isBaseSpacing = i % 2 === 0;
        spacing[`space-${i}`] = {
            $value: isBaseSpacing
                ? { value: 1 + (i % 5), unit: "rem" }
                : `{spacing.space-${Math.floor(i / 2) * 2}}`,
            $type: "dimension",
            $description: `Spacing token ${i}`,
        };

        // Typography tokens (alternating base/reference)
        const isBaseTypography = i % 2 === 0;
        typography[`font-${i}`] = {
            $type: "typography",
            $value: isBaseTypography
                ? {
                      fontFamily: "Inter",
                      fontSize: { value: 16 + (i % 8), unit: "px" },
                      fontWeight: 400 + (i % 5) * 100,
                      letterSpacing: { value: 0.5, unit: "px" },
                      lineHeight: 1.5,
                  }
                : `{typography.font-${Math.floor(i / 2) * 2}}`,
            $description: `Typography token ${i}`,
        };
    }

    return tokens;
}

function generateTokensWithModifiers(baseSize: number, contextCount: number) {
    const baseTokens = generateTokens(baseSize);

    const contextTokens: Record<string, Record<string, unknown>> = {};

    for (let c = 0; c < contextCount; c++) {
        const contextName = `context-${c}`;
        const overrides: Record<string, unknown> = { colors: {} };
        const colors = overrides.colors as Record<string, unknown>;

        for (let i = 0; i < baseSize / 2; i++) {
            colors[`color-${i}`] = {
                $value: `#${(c * 111111 + i).toString(16).padStart(6, "0").slice(0, 6)}`,
                $type: "color",
            };
        }

        contextTokens[contextName] = overrides;
    }

    return { baseTokens, contextTokens };
}

function createMemoryData(
    baseTokens: Record<string, unknown>,
    contextTokens?: Record<string, Record<string, unknown>>
): TokenMemoryData {
    const data: TokenMemoryData = {
        "base.json": {
            content: JSON.stringify(baseTokens),
        },
    };

    if (contextTokens) {
        for (const [contextName, tokens] of Object.entries(contextTokens)) {
            data[`${contextName}.json`] = {
                context: `theme:${contextName}`,
                content: JSON.stringify(tokens),
            };
        }
    }

    return data;
}

function createConfig(): ReturnType<typeof fillDefaults> {
    const userConfig: SugarcubeConfig = {
        resolver: "virtual.resolver.json",
        variables: {
            path: "virtual/tokens.css",
        },
    };
    return fillDefaults(userConfig);
}

describe("pipeline", () => {
    describe("load and resolve", () => {
        bench("small token set (100 tokens)", async () => {
            const tokens = generateTokens(100);
            const config = createConfig();

            await runPipeline({
                type: "memory",
                data: createMemoryData(tokens),
                config,
            });
        });

        bench("medium token set (1,000 tokens)", async () => {
            const tokens = generateTokens(1000);
            const config = createConfig();

            await runPipeline({
                type: "memory",
                data: createMemoryData(tokens),
                config,
            });
        });

        bench("large token set (10,000 tokens)", async () => {
            const tokens = generateTokens(10000);
            const config = createConfig();

            await runPipeline({
                type: "memory",
                data: createMemoryData(tokens),
                config,
            });
        });

        bench("with modifiers (1,000 base + 3 contexts)", async () => {
            const { baseTokens, contextTokens } = generateTokensWithModifiers(1000, 3);
            const config = createConfig();

            await runPipeline({
                type: "memory",
                data: createMemoryData(baseTokens, contextTokens),
                config,
            });
        });
    });

    describe("full pipeline (load + resolve + convert)", () => {
        bench("small token set (100 tokens)", async () => {
            const tokens = generateTokens(100);
            const config = createConfig();

            const { trees, resolved, errors } = await runPipeline({
                type: "memory",
                data: createMemoryData(tokens),
                config,
            });

            await convertTokens(trees, resolved, config, errors.validation);
        });

        bench("medium token set (1,000 tokens)", async () => {
            const tokens = generateTokens(1000);
            const config = createConfig();

            const { trees, resolved, errors } = await runPipeline({
                type: "memory",
                data: createMemoryData(tokens),
                config,
            });

            await convertTokens(trees, resolved, config, errors.validation);
        });

        bench("large token set (10,000 tokens)", async () => {
            const tokens = generateTokens(10000);
            const config = createConfig();

            const { trees, resolved, errors } = await runPipeline({
                type: "memory",
                data: createMemoryData(tokens),
                config,
            });

            await convertTokens(trees, resolved, config, errors.validation);
        });

        bench("with modifiers (1,000 base + 3 contexts)", async () => {
            const { baseTokens, contextTokens } = generateTokensWithModifiers(1000, 3);
            const config = createConfig();

            const { trees, resolved, errors } = await runPipeline({
                type: "memory",
                data: createMemoryData(baseTokens, contextTokens),
                config,
            });

            await convertTokens(trees, resolved, config, errors.validation);
        });
    });

    describe("expand-tree stage ($ref and $extends)", () => {
        function buildRefTree(size: number): TokenTree {
            const tokens: Record<string, unknown> = {
                base: { $type: "color" as const },
            };
            const base = tokens.base as Record<string, unknown>;

            for (let i = 0; i < size; i++) {
                if (i % 3 === 0) {
                    base[`color-${i}`] = { $value: "#ff0000" };
                } else {
                    base[`color-${i}`] = { $ref: `#/base/color-${Math.floor(i / 3) * 3}` };
                }
            }
            return { sourcePath: "bench.json", tokens: tokens as TokenGroup };
        }

        function buildExtendsTree(groupCount: number, tokensPerGroup: number): TokenTree {
            const tokens: Record<string, unknown> = {};

            // Base group
            const baseGroup: Record<string, unknown> = { $type: "color" as const };
            for (let t = 0; t < tokensPerGroup; t++) {
                baseGroup[`token-${t}`] = { $value: `#${t.toString(16).padStart(6, "0")}` };
            }
            tokens["base-group"] = baseGroup;

            // Derived groups extending base
            for (let g = 1; g < groupCount; g++) {
                const group: Record<string, unknown> = { $extends: "{base-group}" };
                // Override one token
                group["token-0"] = {
                    $value: `#${(g * 111111).toString(16).padStart(6, "0").slice(0, 6)}`,
                };
                tokens[`group-${g}`] = group;
            }
            return { sourcePath: "bench.json", tokens: tokens as TokenGroup };
        }

        function buildExtendsChainTree(chainLength: number, tokensPerGroup: number): TokenTree {
            const tokens: Record<string, unknown> = {};

            for (let g = 0; g < chainLength; g++) {
                const group: Record<string, unknown> = { $type: "color" as const };
                if (g > 0) {
                    group.$extends = `{group-${g - 1}}`;
                }
                for (let t = 0; t < tokensPerGroup; t++) {
                    group[`token-${t}`] = {
                        $value: `#${(g * 1000 + t).toString(16).padStart(6, "0").slice(0, 6)}`,
                    };
                }
                tokens[`group-${g}`] = group;
            }
            return { sourcePath: "bench.json", tokens: tokens as TokenGroup };
        }

        bench("with $ref - small (100 refs)", () => {
            expand([buildRefTree(100)]);
        });

        bench("with $ref - medium (500 refs)", () => {
            expand([buildRefTree(500)]);
        });

        bench("with $ref - large (1,000 refs)", () => {
            expand([buildRefTree(1000)]);
        });

        bench("with $extends - shallow (10 groups, 50 tokens each)", () => {
            expand([buildExtendsTree(10, 50)]);
        });

        bench("with $extends - deep chain (50 groups, 10 tokens each)", () => {
            expand([buildExtendsChainTree(50, 10)]);
        });

        bench("with $extends - wide (100 groups, 5 tokens each)", () => {
            expand([buildExtendsTree(100, 5)]);
        });
    });
});
