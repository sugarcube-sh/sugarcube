import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { fillDefaults } from "@sugarcube-sh/core";
import type { SugarcubeConfig, UtilityClassesConfig } from "@sugarcube-sh/core";
import { describe, expect, it } from "vitest";
import wwwConfig from "../../../apps/www/sugarcube.config.js";
import studioConfig from "../../studio/sugarcube.config.js";
import { createWatchSession } from "../src/watch/regenerate.js";

const ROOT = resolve(__dirname, "../../..");
const GOLDEN_DIR = join(__dirname, "__golden__");
const CORE_FIXTURES = join(ROOT, "packages/core/tests/__fixtures__");
const REGISTRY_TOKENS = join(ROOT, "apps/www/registry/tokens");

type GoldenCase = {
    name: string;
    resolver?: string;
    files?: string[];
    config?: SugarcubeConfig;
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

const CASES: GoldenCase[] = [
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

async function generate(goldenCase: GoldenCase, dir: string) {
    const base = goldenCase.config ?? {};
    const resolver = goldenCase.files
        ? writeSingleSetResolver(dir, goldenCase.files)
        : (goldenCase.resolver ?? base.resolver);
    const outDir = join(dir, "out");
    const config = fillDefaults({
        ...base,
        resolver,
        content: [join(dir, "no-markup/**/*.html")],
        variables: { ...base.variables, path: join(outDir, "variables.css") },
        utilities: { ...base.utilities, path: join(outDir, "utilities.css") },
    });
    const { output } = await createWatchSession(config).primeAndBuild();
    return output.map((file) => ({
        name: relative(outDir, file.path),
        css: file.css.replace(/^\/\* Generated by @sugarcube-sh\/cli v[^*]*\*\/\n\n/, ""),
    }));
}

describe("golden CSS", () => {
    it.each(CASES.map((goldenCase) => [goldenCase.name, goldenCase] as const))(
        "%s",
        async (_name, goldenCase) => {
            const dir = mkdtempSync(join(tmpdir(), "sugarcube-golden-"));
            try {
                const files = await generate(goldenCase, dir);
                expect(files.length).toBeGreaterThan(0);
                for (const file of files) {
                    await expect(file.css).toMatchFileSnapshot(
                        join(GOLDEN_DIR, goldenCase.name, file.name),
                    );
                }
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
    );
});
