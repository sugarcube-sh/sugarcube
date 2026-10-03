import { copyFileSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { errors } from "@sugarcube-sh/dtcg";
import { read } from "@sugarcube-sh/dtcg/node";
import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { emitCSS } from "../src/shared/css/emit.js";
import { readOptions } from "../src/shared/read-options.js";
import type { SugarcubeConfig } from "../src/types/config.js";

const repo = join(import.meta.dirname, "../../..");
const fixtures = join(repo, "packages/core/tests/__fixtures__");
const registry = join(repo, "apps/www/registry/tokens");
const everyValueForm = join(repo, "packages/cli/tests/__fixtures__/every-value-form");
const golden = join(repo, "packages/cli/tests/__golden__");

interface Case {
    name: string;
    resolver?: string;
    files?: string[];
    variables?: SugarcubeConfig["variables"];
    problems?: string[];
}

const partialTypography = (path: string, parts: number) =>
    Array.from({ length: parts }, () => `invalid-value missing-property ${path}`);

const cases: Case[] = [
    ...[
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
    ].map((name) => ({
        name: `core/resolver/${name}`,
        resolver: join(fixtures, "resolver", `${name}.resolver.json`),
    })),
    {
        name: "core/resolver/provenance",
        resolver: join(fixtures, "resolver/provenance/provenance.resolver.json"),
    },
    { name: "core/tokens/basic", resolver: join(fixtures, "tokens/basic.resolver.json") },
    ...["colors", "fluid", "metadata", "references", "tokens", "utility-basic"].map((name) => ({
        name: `core/tokens/${name}`,
        files: [join(fixtures, "tokens", `${name}.json`)],
    })),
    {
        name: "core/tokens/glob",
        files: [join(fixtures, "tokens/glob/a.json"), join(fixtures, "tokens/glob/b.json")],
    },
    {
        name: "cli/valid-tokens",
        files: [join(repo, "packages/cli/tests/__fixtures__/valid-tokens.json")],
    },
    {
        name: "cli/e2e-minimal",
        resolver: join(repo, "packages/cli/tests/e2e/__fixtures__/minimal.resolver.json"),
    },
    {
        name: "studio/demo",
        resolver: join(repo, "packages/studio/demo/tokens.resolver.json"),
    },
    {
        name: "studio/design-tokens",
        resolver: join(repo, "packages/studio/src/design-tokens/tokens.resolver.json"),
        variables: {
            permutations: [
                { input: {}, selector: ":root" },
                ...["accent", "neutral"].map((variant) => ({
                    input: { variant },
                    selector: `[data-variant="${variant}"]`,
                })),
            ],
        },
    },
    {
        name: "registry/starter-kits/fluid",
        resolver: join(registry, "starter-kits/fluid/tokens.resolver.json"),
    },
    {
        name: "registry/starter-kits/static",
        resolver: join(registry, "starter-kits/static/tokens.resolver.json"),
    },
    {
        name: "every-value-form/native",
        resolver: join(everyValueForm, "tokens.resolver.json"),
        variables: {
            prefix: "ds",
            layer: "tokens",
            propagateDependents: true,
            transforms: { fluid: { min: 360, max: 1440 }, colorFallbackStrategy: "native" },
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
        problems: partialTypography("typography.partial", 3),
    },
    {
        name: "every-value-form/polyfill",
        resolver: join(everyValueForm, "polyfill/tokens.resolver.json"),
        variables: {
            variableName: (path: string) => path.replaceAll(".", "_"),
            transforms: { colorFallbackStrategy: "polyfill" },
            permutations: [
                { input: {}, selector: ":root" },
                { input: { theme: "dark" }, selector: '[data-theme="dark"]', path: "dark.css" },
            ],
        },
    },
    ...["size-demo", "space-demo"].map((name) => ({
        name: `registry/recipes/${name}`,
        files: [join(registry, "recipes", `${name}.json`)],
    })),
];

function resolverFor({ resolver, files = [] }: Case): string {
    if (resolver) return resolver;
    const dir = mkdtempSync(join(tmpdir(), "golden-css-"));
    for (const file of files) copyFileSync(file, join(dir, basename(file)));
    const path = join(dir, "tokens.resolver.json");
    const sources = files.map((file) => ({ $ref: basename(file) }));
    writeFileSync(
        path,
        JSON.stringify({
            version: "2025.10",
            resolutionOrder: [{ type: "set", name: "base", sources }],
        }),
    );
    return path;
}

async function readCase(each: Case) {
    const resolver = resolverFor(each);
    const variables = { path: "variables.css", ...each.variables };
    const config = fillDefaults({ resolver, variables });
    return { config, doc: await read(resolver, readOptions(config)) };
}

describe("golden CSS: the new core reads every golden case", () => {
    it.for(cases)("$name", async (each) => {
        const { doc } = await readCase(each);
        const found = errors(doc).map(({ kind, detail, path }) => {
            const reason = "reason" in detail ? ` ${String(detail.reason)}` : "";
            return `${kind}${reason} ${path ?? ""}`.trimEnd();
        });
        expect(found).toStrictEqual(each.problems ?? []);
    });
});

const configOptions =
    "atRule, selector lists, path, propagateDependents, polyfill and layers are not written yet";

const pending: Record<string, string> = {
    "every-value-form/native/variables.css": configOptions,
    "every-value-form/polyfill/variables.css": configOptions,
    "every-value-form/polyfill/dark.css": configOptions,
};

interface Decision {
    because: string;
    explains: (before: string, after: string) => boolean;
}

const decisions = {
    order: {
        because:
            "whole-number keys stay where the file writes them; old sugarcube sorted them first",
        explains: () => false,
    },
    fluid: {
        because:
            "fluid sizes are worked out as Utopia does, to four decimals, with a size that shrinks as the screen widens kept in order",
        explains: (before, after) => before.startsWith("clamp(") && after.startsWith("clamp("),
    },
    dashed: {
        because: "CSS cannot draw a dash pattern, so one is written dashed (Format 9.3.3)",
        explains: (before, after) =>
            /\b(round|butt|square)\b/.test(before) &&
            /\bdashed\b/.test(after) &&
            !/\b(round|butt|square)\b/.test(after),
    },
} satisfies Record<string, Decision>;

const decided: Record<string, (keyof typeof decisions)[]> = {
    "studio/design-tokens/variables.css": ["order"],
    "core/tokens/fluid/variables.css": ["fluid"],
    "studio/demo/variables.css": ["fluid", "dashed"],
    "registry/starter-kits/fluid/variables.css": ["fluid"],
    "registry/recipes/size-demo/variables.css": ["fluid"],
    "registry/recipes/space-demo/variables.css": ["fluid"],
};

interface Block {
    selector: string;
    names: string[];
    values: Map<string, string>;
}

function blocksOf(css: string): Block[] {
    return css
        .trimEnd()
        .split("\n\n")
        .map((block) => {
            const lines = block.split("\n");
            const declared = lines.flatMap((line) => {
                const found = /^ {4}(--[^:]+): (.*);$/.exec(line);
                return found?.[1] && found[2] !== undefined ? [[found[1], found[2]] as const] : [];
            });
            return {
                selector: lines
                    .filter((line) => !line.startsWith("    ") && line !== "}")
                    .join("\n"),
                names: declared.map(([name]) => name),
                values: new Map(declared),
            };
        });
}

function unexplained(css: string, expected: string, listed: (keyof typeof decisions)[]) {
    const [written, old] = [blocksOf(css), blocksOf(expected)];
    const sameNames = (block: Block, index: number) => {
        const other = old[index]?.names ?? [];
        return listed.includes("order")
            ? [...block.names].sort().join() === [...other].sort().join()
            : block.names.join() === other.join();
    };
    const used = new Set<keyof typeof decisions>(listed.includes("order") ? ["order"] : []);
    const problems: string[] = [];
    if (
        written.map(({ selector }) => selector).join() !==
        old.map(({ selector }) => selector).join()
    )
        problems.push("the blocks differ");
    written.forEach((block, index) => {
        if (!sameNames(block, index)) problems.push(`${block.selector}: the variables differ`);
        for (const [name, after] of block.values) {
            const before = old[index]?.values.get(name);
            if (before === undefined || before === after) continue;
            const by = listed.find((key) => decisions[key].explains(before, after));
            if (by) used.add(by);
            else problems.push(`${name}: ${before} → ${after}`);
        }
    });
    for (const key of listed) if (!used.has(key)) problems.push(`${key} explains nothing here`);
    return problems;
}

const goldenFiles = cases.flatMap((each) =>
    readdirSync(join(golden, each.name))
        .filter((file) => file !== "utilities.css")
        .map((file) => ({ name: `${each.name}/${file}`, each, file })),
);

describe("golden CSS: the new core writes what old sugarcube writes", () => {
    it.for(goldenFiles)("$name", async ({ name, each, file }) => {
        const { config, doc } = await readCase(each);
        const { files } = emitCSS(doc, config);
        const css = files.find(({ path }) => path === file)?.css ?? "";
        const expected = readFileSync(join(golden, name), "utf8");
        const listed = decided[name];
        if (pending[name]) expect(css, `pending (${pending[name]}) but matches`).not.toBe(expected);
        else if (listed) {
            const because = listed.map((key) => decisions[key].because).join("; ");
            expect(css, `differs because ${because} but matches`).not.toBe(expected);
            expect(unexplained(css, expected, listed)).toStrictEqual([]);
        } else expect(css).toBe(expected);
    });

    it("lists as pending or decided only files the golden set has, and none as both", () => {
        const names = new Set(goldenFiles.map(({ name }) => name));
        const listed = [...Object.keys(pending), ...Object.keys(decided)];
        expect(listed.filter((name) => !names.has(name))).toStrictEqual([]);
        expect(Object.keys(decided).filter((name) => name in pending)).toStrictEqual([]);
    });
});
