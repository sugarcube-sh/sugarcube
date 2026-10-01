import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { type Document, read, readFromMemory } from "@sugarcube-sh/dtcg";
import { beforeAll, describe, expect, it } from "vitest";
import { loadTokens } from "../src/node/load-tokens.js";
import { SUGARCUBE_NAMESPACE } from "../src/shared/extensions.js";
import { isToken } from "../src/shared/guards.js";
import { expand } from "../src/shared/pipeline/expand.js";
import { scaleGenerator } from "../src/shared/scale/generator.js";
import { readScaleRecipe } from "../src/shared/scale/recipe.js";
import { validateScaleExtension } from "../src/shared/validators/scale.js";
import type { TokenTree } from "../src/types/tokens.js";

const repo = join(import.meta.dirname, "../../..");
const tokenFolders = [
    "packages/core/tests/__fixtures__",
    "packages/cli/tests/__fixtures__",
    "packages/cli/tests/e2e/__fixtures__",
    "packages/studio/demo",
    "packages/studio/src/design-tokens",
    "apps/www/registry/tokens",
];
const notTokenFiles = ["packages/core/tests/__fixtures__/tokens/validators/"];

interface Made {
    path: string;
    value: unknown;
    fluid: unknown;
}

function jsonFiles(): string[] {
    return tokenFolders
        .flatMap((folder) =>
            readdirSync(join(repo, folder), { recursive: true, withFileTypes: true })
                .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
                .map((entry) => relative(repo, join(entry.parentPath, entry.name))),
        )
        .filter((file) => !notTokenFiles.some((prefix) => file.startsWith(prefix)))
        .sort();
}

function onlyIn<T>(these: Set<T>, those: Set<T>): T[] {
    return [...these].filter((each) => !those.has(each));
}

function key({ path, value, fluid }: Made): string {
    return `${path} ${JSON.stringify(value)} ${JSON.stringify(fluid)}`;
}

function tokensIn(node: unknown, path: string[] = [], found = new Map<string, unknown>()) {
    if (typeof node !== "object" || node === null) return found;
    for (const [name, child] of Object.entries(node)) {
        if (name.startsWith("$") && name !== "$root") continue;
        if (isToken(child)) found.set([...path, name].join("."), child);
        else tokensIn(child, [...path, name], found);
    }
    return found;
}

function hasScale(tree: unknown, groupPath: string): boolean {
    let node = tree as Record<string, unknown> | undefined;
    for (const name of groupPath === "" ? [] : groupPath.split(".")) {
        node = node?.[name] as Record<string, unknown> | undefined;
    }
    const extensions = node?.$extensions as Record<string, { scale?: unknown }> | undefined;
    return extensions?.[SUGARCUBE_NAMESPACE]?.scale !== undefined;
}

function madeByOldExpand(trees: TokenTree[]): Made[] {
    const { trees: expanded } = expand(trees);
    return expanded.flatMap((tree, i) => {
        const before = tokensIn(trees[i]?.tokens);
        return [...tokensIn(tree.tokens)]
            .filter(([path]) => !before.has(path))
            .filter(([path]) => hasScale(tree.tokens, path.split(".").slice(0, -1).join(".")))
            .map(([path, token]) => {
                const { $value, $extensions } = token as {
                    $value: unknown;
                    $extensions?: Record<string, { fluid?: unknown }>;
                };
                return { path, value: $value, fluid: $extensions?.[SUGARCUBE_NAMESPACE]?.fluid };
            });
    });
}

function madeByDtcg(doc: Document): Made[] {
    return doc.permutations.flatMap((permutation) =>
        permutation.tokens
            .filter((token) => token.generated && !token.authored)
            .map((token) => ({
                path: token.path,
                value: token.value,
                fluid: (token.extensions?.[SUGARCUBE_NAMESPACE] as { fluid?: unknown } | undefined)
                    ?.fluid,
            })),
    );
}

const projects: { name: string; old: Made[]; dtcg: Made[] }[] = [];

beforeAll(async () => {
    const files = jsonFiles();
    const covered = new Set<string>();
    for (const entry of files.filter((file) => file.endsWith(".resolver.json"))) {
        const resolverPath = join(repo, entry);
        const loaded = await loadTokens({
            type: "resolver",
            resolverPath,
            config: { variables: {} } as never,
        });
        const doc = await read(entry, {
            readText: (path) => readFile(join(repo, path), "utf8"),
            generators: [scaleGenerator],
        });
        for (const file of doc.files) covered.add(join(entry, "..", file));
        if (loaded.errors.length > 0) continue;
        projects.push({ name: entry, old: madeByOldExpand(loaded.trees), dtcg: madeByDtcg(doc) });
    }
    for (const file of files.filter(
        (each) => !each.endsWith(".resolver.json") && !covered.has(each),
    )) {
        const text = readFileSync(join(repo, file), "utf8");
        let tokens: TokenTree["tokens"];
        try {
            tokens = JSON.parse(text);
        } catch {
            continue;
        }
        const doc = readFromMemory({ files: { [file]: text } }, { generators: [scaleGenerator] });
        projects.push({
            name: file,
            old: madeByOldExpand([{ sourcePath: file, tokens }]),
            dtcg: madeByDtcg(doc),
        });
    }
});

describe("the tokens scale recipes make, old expand against dtcg with the scale generator", () => {
    it("finds the projects in the repo that have recipes", () => {
        const withRecipes = projects
            .filter(({ old, dtcg }) => old.length + dtcg.length > 0)
            .map(({ name, dtcg }) => ({ name, tokens: new Set(dtcg.map(key)).size }));
        expect(withRecipes).toEqual([
            { name: "packages/studio/demo/tokens.resolver.json", tokens: 14 },
            { name: "apps/www/registry/tokens/recipes/size-demo.json", tokens: 13 },
            { name: "apps/www/registry/tokens/recipes/space-demo.json", tokens: 18 },
        ]);
    });

    it("reads Studio's demo, whose type scale is a recipe, with nothing missing", async () => {
        const doc = await read("packages/studio/demo/tokens.resolver.json", {
            readText: (path) => readFile(join(repo, path), "utf8"),
            generators: [scaleGenerator],
        });
        expect(doc.diagnostics.filter(({ kind }) => kind === "missing-reference")).toEqual([]);
    });

    it("makes the same tokens, with the same values, in every project", () => {
        const differences = projects.flatMap(({ name, old, dtcg }) => {
            const oldKeys = new Set(old.map(key));
            const dtcgKeys = new Set(dtcg.map(key));
            return onlyIn(oldKeys, dtcgKeys)
                .map((each) => `${name}: only old: ${each}`)
                .concat(onlyIn(dtcgKeys, oldKeys).map((each) => `${name}: only dtcg: ${each}`));
        });
        expect(differences).toEqual([]);
    });
});

const base = { min: { value: 1, unit: "rem" }, max: { value: 1.125, unit: "rem" } };
const exponential = {
    mode: "exponential",
    base,
    ratio: { min: 1.2, max: 1.25 },
    steps: { negative: 2, positive: 5 },
};
const multipliers = { mode: "multipliers", base, multipliers: { sm: 1, md: 1.5, lg: 2 } };
const without = (recipe: Record<string, unknown>, name: string) =>
    Object.fromEntries(Object.entries(recipe).filter(([property]) => property !== name));

const pairsWithoutMultipliers = { ...multipliers, multipliers: "x", pairs: ["sm-md"] };
const referenceInAnUnreadPart = { ...exponential, extra: { deep: ["{x}"] } };

const badRecipes: unknown[] = [
    "nope",
    null,
    [],
    3,
    "{size.scale}",
    without(exponential, "mode"),
    { ...exponential, mode: "linear" },
    { ...exponential, mode: 3 },
    without(exponential, "base"),
    { ...exponential, base: "x" },
    { ...exponential, base: {} },
    { ...exponential, base: { min: 1, max: null } },
    { ...exponential, base: { min: { value: 1, unit: "em" }, max: { value: "1", unit: "rem" } } },
    { ...exponential, base: { min: { unit: "rem" }, max: { value: 1 } } },
    without(exponential, "ratio"),
    without(exponential, "steps"),
    { ...exponential, ratio: "x" },
    { ...exponential, ratio: {} },
    { ...exponential, ratio: { min: 1, max: -1 } },
    { ...exponential, ratio: { min: "2", max: 1.5 } },
    { ...exponential, steps: "x" },
    { ...exponential, steps: { negative: -1, positive: 1.5 } },
    { ...exponential, steps: {} },
    without(multipliers, "multipliers"),
    { ...multipliers, multipliers: {} },
    { ...multipliers, multipliers: [] },
    { ...multipliers, multipliers: "x" },
    { ...multipliers, multipliers: { sm: 1, md: "1.5x" } },
    { ...multipliers, pairs: "yes" },
    { ...multipliers, pairs: 3 },
    { ...multipliers, pairs: ["sm_lg", 4, "sm-xxl", "zz-yy", "-sm", "sm-"] },
    pairsWithoutMultipliers,
    {
        ...exponential,
        base: { min: { value: "{size.base}", unit: "rem" }, max: { value: 1.125, unit: "rem" } },
    },
    { ...multipliers, multipliers: { sm: "{multiplier.small}", md: 1.5 } },
    { ...multipliers, pairs: ["{a}", "sm-md"] },
    { ...exponential, ratio: "{ratio}" },
    { mode: "{mode}" },
    referenceInAnUnreadPart,
];

const knownDifferences = [
    {
        recipe: pairsWithoutMultipliers,
        only: "old",
        place: "scale.pairs[0]",
        why: "a pair is not checked against multipliers when there are none to check",
    },
    {
        recipe: referenceInAnUnreadPart,
        only: "old",
        place: "scale.extra.deep[0]",
        why: "the reader reads only the parts a recipe has; old sugarcube scanned every part for references",
    },
];

function place(steps: (string | number)[]): string {
    return steps.reduce<string>(
        (joined, step) => (typeof step === "number" ? `${joined}[${step}]` : `${joined}.${step}`),
        "scale",
    );
}

describe("the problems scale recipes report, old sugarcube's validator against the new reader", () => {
    it("finds problems in the same places, apart from the differences known and wanted", () => {
        const differences = badRecipes.flatMap((recipe) => {
            const old = new Set(
                validateScaleExtension(recipe, "scale", { sourcePath: "tokens.json" }).map(
                    ({ path }) => path,
                ),
            );
            const result = readScaleRecipe(recipe);
            const now = new Set(result.ok ? [] : result.errors.map(({ path }) => place(path)));
            return onlyIn(old, now)
                .map((at) => ({ recipe, only: "old", place: at }))
                .concat(onlyIn(now, old).map((at) => ({ recipe, only: "new", place: at })));
        });
        expect(differences).toEqual(
            knownDifferences.map(({ why: _why, ...difference }) => difference),
        );
    });
});
