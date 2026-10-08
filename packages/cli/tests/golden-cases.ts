import { copyFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { type InternalConfig, fillDefaults } from "@sugarcube-sh/core";
import type { SugarcubeConfig, UtilityClassesConfig } from "@sugarcube-sh/core";
import wwwConfig from "../../../apps/www/sugarcube.config.js";
import studioConfig from "../../studio/sugarcube.config.js";

const ROOT = resolve(__dirname, "../../..");
export const GOLDEN_DIR = join(__dirname, "__golden__");
const CORE_FIXTURES = join(ROOT, "packages/core/tests/__fixtures__");
const REGISTRY_TOKENS = join(ROOT, "apps/www/registry/tokens");
const EVERY_VALUE_FORM_RESOLVER = join(
    __dirname,
    "__fixtures__/every-value-form/tokens.resolver.json",
);

export type GoldenCase = {
    name: string;
    resolver?: string;
    files?: string[];
    config?: SugarcubeConfig | ((outDir: string) => SugarcubeConfig);
};

const CORE_RESOLVERS = [
    "breakpoint-cascade",
    "breakpoint-distinct",
    "breakpoint-shared",
    "complex",
    "multiple-modifiers",
    "no-modifiers",
    "non-orthogonal-modifiers",
    "private-sets",
    "private-source",
    "propagate-chain",
    "scheme",
    "simple",
    "with-extending",
    "with-file-refs",
    "with-refs",
];

const CORE_TOKEN_FILES = ["colors", "fluid", "metadata", "references", "tokens", "utility-basic"];

function withSafelist(classes: UtilityClassesConfig | undefined): UtilityClassesConfig | undefined {
    if (!classes) return undefined;
    return Object.fromEntries(
        Object.entries(classes).map(([property, entry]) => [
            property,
            Array.isArray(entry)
                ? entry.map((item) => ({ ...item, safelist: true }))
                : { ...entry, safelist: true },
        ]),
    );
}

function fromProject(config: SugarcubeConfig, projectDir: string): SugarcubeConfig {
    return {
        resolver: resolve(projectDir, config.resolver ?? ""),
        variables: config.variables,
        utilities: { ...config.utilities, classes: withSafelist(config.utilities?.classes) },
    };
}

const EVERY_VALUE_FORM_CLASSES: UtilityClassesConfig = {
    "color": { source: "color.*", prefix: "text", stripDuplicates: true, safelist: true },
    "background-color": { source: "color.*", prefix: "bg", safelist: true },
    "padding": {
        source: "space.*",
        prefix: "p",
        directions: ["all", "x", "y", "top", "left"],
        safelist: true,
    },
    "margin": [
        { source: "space.*", prefix: "m", directions: ["all"], safelist: ["small", "fluid"] },
        { source: "space.*", prefix: "m", directions: ["x", "bottom"], safelist: ["medium"] },
    ],
    "font-family": { source: "font.family.*", prefix: "font", safelist: true },
    "font-weight": { source: "font.weight.*", prefix: "weight", safelist: true },
    "box-shadow": { source: "shadow.*", safelist: true },
    "--flow-space": { source: "space.*", prefix: "flow", safelist: true },
};

export const CASES: GoldenCase[] = [
    ...CORE_RESOLVERS.map((name) => ({
        name: `core/resolver/${name}`,
        resolver: join(CORE_FIXTURES, "resolver", `${name}.resolver.json`),
    })),
    {
        name: "core/resolver/provenance",
        resolver: join(CORE_FIXTURES, "resolver/provenance/provenance.resolver.json"),
    },
    {
        name: "core/tokens/basic",
        resolver: join(CORE_FIXTURES, "tokens/basic.resolver.json"),
    },
    ...CORE_TOKEN_FILES.map((name) => ({
        name: `core/tokens/${name}`,
        files: [join(CORE_FIXTURES, "tokens", `${name}.json`)],
    })),
    {
        name: "core/tokens/glob",
        files: [
            join(CORE_FIXTURES, "tokens/glob/a.json"),
            join(CORE_FIXTURES, "tokens/glob/b.json"),
        ],
    },
    {
        name: "cli/valid-tokens",
        files: [join(ROOT, "packages/cli/tests/__fixtures__/valid-tokens.json")],
    },
    {
        name: "cli/e2e-minimal",
        resolver: join(ROOT, "packages/cli/tests/e2e/__fixtures__/minimal.resolver.json"),
    },
    {
        name: "studio/demo",
        resolver: join(ROOT, "packages/studio/demo/tokens.resolver.json"),
    },
    {
        name: "studio/design-tokens",
        config: fromProject(studioConfig, join(ROOT, "packages/studio")),
    },
    {
        name: "registry/starter-kits/fluid",
        config: fromProject(wwwConfig, join(ROOT, "apps/www")),
    },
    {
        name: "registry/starter-kits/static",
        resolver: join(REGISTRY_TOKENS, "starter-kits/static/tokens.resolver.json"),
    },
    {
        name: "every-value-form/native",
        resolver: EVERY_VALUE_FORM_RESOLVER,
        config: {
            variables: {
                prefix: "ds",
                layer: "tokens",
                propagateDependents: true,
                transforms: {
                    fluid: { min: 360, max: 1440 },
                    colorFallbackStrategy: "native",
                },
                permutations: [
                    { input: { theme: "light" }, selector: ":root" },
                    {
                        input: { theme: "dark" },
                        selector: ":root",
                        atRule: "@media (prefers-color-scheme: dark)",
                    },
                    { input: { theme: "dark" }, selector: ['[data-theme="dark"]', ".dark"] },
                ],
            },
            utilities: { layer: "utilities", classes: EVERY_VALUE_FORM_CLASSES },
        },
    },
    {
        name: "every-value-form/polyfill",
        resolver: join(__dirname, "__fixtures__/every-value-form/polyfill/tokens.resolver.json"),
        config: (outDir): SugarcubeConfig => ({
            variables: {
                variableName: (path: string) => path.replaceAll(".", "_"),
                transforms: { colorFallbackStrategy: "polyfill" },
                permutations: [
                    { input: {}, selector: ":root" },
                    {
                        input: { theme: "dark" },
                        selector: '[data-theme="dark"]',
                        path: join(outDir, "dark.css"),
                    },
                ],
            },
            utilities: {
                classes: {
                    color: { source: "color.*", prefix: "text", safelist: true },
                },
            },
        }),
    },
    ...["size-demo", "space-demo"].map((name) => ({
        name: `registry/recipes/${name}`,
        files: [join(REGISTRY_TOKENS, "recipes", `${name}.json`)],
    })),
];

function writeSingleSetResolver(dir: string, files: string[]): string {
    for (const file of files) copyFileSync(file, join(dir, basename(file)));
    const resolverPath = join(dir, "tokens.resolver.json");
    writeFileSync(
        resolverPath,
        JSON.stringify({
            version: "2025.10",
            name: "golden",
            resolutionOrder: [
                {
                    type: "set",
                    name: "base",
                    sources: files.map((file) => ({ $ref: basename(file) })),
                },
            ],
        }),
    );
    return resolverPath;
}

export function goldenConfig(goldenCase: GoldenCase, dir: string, outDir: string): InternalConfig {
    const base =
        typeof goldenCase.config === "function"
            ? goldenCase.config(outDir)
            : (goldenCase.config ?? {});
    const resolver = goldenCase.files
        ? writeSingleSetResolver(dir, goldenCase.files)
        : (goldenCase.resolver ?? base.resolver);
    return fillDefaults({
        ...base,
        resolver,
        content: [join(dir, "no-markup/**/*.html")],
        variables: { ...base.variables, path: join(outDir, "variables.css") },
        utilities: { ...base.utilities, path: join(outDir, "utilities.css") },
    });
}

export function withoutBanner(css: string): string {
    return css.replace(/^\/\* Generated by @sugarcube-sh\/cli v[^*]*\*\/\n\n/, "");
}
