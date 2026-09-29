import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, bench, describe } from "vitest";
import { fillDefaults } from "../../src/node/config/normalize.js";
import { loadTokens } from "../../src/node/load-tokens.js";
import { generateCSSVariables } from "../../src/shared/generate-css-variables.js";
import { assignCSSNames } from "../../src/shared/pipeline/assign-css-names.js";
import { groupByContext } from "../../src/shared/pipeline/group-by-context.js";
import { resolveTokens } from "../../src/shared/resolve-tokens.js";
import type { TokenPipelineSource } from "../../src/types/pipelines.js";

const TOKENS_PER_GROUP = 100;

const MODIFIERS = {
    theme: ["light", "dark", "dim", "sepia"],
    density: ["regular", "compact", "spacious"],
    contrast: ["standard", "high"],
} as const;

function baseTokens() {
    const color: Record<string, unknown> = { $type: "color" };
    const space: Record<string, unknown> = { $type: "dimension" };
    const text: Record<string, unknown> = { $type: "typography" };

    for (let i = 0; i < TOKENS_PER_GROUP; i++) {
        const base = Math.floor(i / 3) * 3;
        color[`c${i}`] = { $value: i % 3 === 0 ? "#ff0000" : `{color.c${base}}` };
        space[`s${i}`] = {
            $value: i % 2 === 0 ? { value: 1 + (i % 5), unit: "rem" } : `{space.s${i - 1}}`,
        };
        text[`t${i}`] = {
            $value:
                i % 2 === 0
                    ? {
                          fontFamily: "Inter",
                          fontSize: { value: 16 + (i % 8), unit: "px" },
                          fontWeight: 400 + (i % 5) * 100,
                          letterSpacing: { value: 0.5, unit: "px" },
                          lineHeight: 1.5,
                      }
                    : `{text.t${i - 1}}`,
        };
    }

    return { color, space, text };
}

function colorOverrides(seed: number, count: number) {
    const color: Record<string, unknown> = {};
    for (let i = 0; i < count; i += 3) {
        color[`c${i}`] = {
            $type: "color",
            $value: `#${((seed * 40503 + i * 97) % 0xffffff).toString(16).padStart(6, "0")}`,
        };
    }
    return { color };
}

function spaceOverrides(scale: number) {
    const space: Record<string, unknown> = {};
    for (let i = 0; i < TOKENS_PER_GROUP; i += 2) {
        space[`s${i}`] = {
            $type: "dimension",
            $value: { value: (1 + (i % 5)) * scale, unit: "rem" },
        };
    }
    return { space };
}

function modifierContexts(name: keyof typeof MODIFIERS): Record<string, unknown[]> {
    return Object.fromEntries(
        MODIFIERS[name].map((context, index) => {
            if (index === 0) return [context, []];
            if (name === "density") return [context, [spaceOverrides(index === 1 ? 0.75 : 1.25)]];
            if (name === "contrast") return [context, [colorOverrides(99, TOKENS_PER_GROUP)]];
            return [context, [colorOverrides(index, TOKENS_PER_GROUP)]];
        }),
    );
}

function everyInput(): Array<Record<string, string>> {
    const inputs: Array<Record<string, string>> = [];
    for (const theme of MODIFIERS.theme) {
        for (const density of MODIFIERS.density) {
            for (const contrast of MODIFIERS.contrast) {
                inputs.push({ theme, density, contrast });
            }
        }
    }
    return inputs;
}

function makeFixture(): { source: TokenPipelineSource; cleanup: () => void } {
    const dir = mkdtempSync(join(tmpdir(), "sugarcube-permutations-bench-"));
    writeFileSync(join(dir, "base.json"), JSON.stringify(baseTokens()));

    const resolutionOrder = [
        { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
        ...(Object.keys(MODIFIERS) as Array<keyof typeof MODIFIERS>).map((name) => ({
            type: "modifier",
            name,
            default: MODIFIERS[name][0],
            contexts: modifierContexts(name),
        })),
    ];

    const resolverPath = join(dir, "tokens.resolver.json");
    writeFileSync(
        resolverPath,
        JSON.stringify({ version: "2025.10", name: "permutations-bench", resolutionOrder }),
    );

    const config = fillDefaults({
        resolver: resolverPath,
        variables: {
            path: join(dir, "out.css"),
            permutations: everyInput().map((input, index) => ({
                input,
                selector:
                    index === 0
                        ? ":root"
                        : `[data-theme="${input.theme}"][data-density="${input.density}"][data-contrast="${input.contrast}"]`,
            })),
        },
    });

    return {
        source: { type: "resolver", resolverPath, config },
        cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
}

const fixture = makeFixture();
afterAll(() => fixture.cleanup(), 60_000);

describe("24 permutations (4 × 3 × 2 contexts, 300 tokens)", () => {
    bench("load and resolve", async () => {
        const loaded = await loadTokens(fixture.source);
        resolveTokens(loaded.trees);
    });

    bench("load, resolve and convert", async () => {
        const loaded = await loadTokens(fixture.source);
        const { trees, resolved } = resolveTokens(loaded.trees);
        assignCSSNames(groupByContext(trees, resolved), fixture.source.config);
    });

    bench("load, resolve, convert and generate CSS", async () => {
        const loaded = await loadTokens(fixture.source);
        const { trees, resolved } = resolveTokens(loaded.trees);
        const converted = assignCSSNames(groupByContext(trees, resolved), fixture.source.config);
        await generateCSSVariables(converted, fixture.source.config, loaded.permutations);
    });
});
