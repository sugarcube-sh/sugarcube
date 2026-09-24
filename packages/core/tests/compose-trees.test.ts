import { readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadTokens } from "../src/node/load-tokens.js";
import { composeTrees } from "../src/shared/compose-trees.js";
import { isResolvedToken } from "../src/shared/guards.js";
import { resolveTokens } from "../src/shared/resolve-tokens.js";
import type { ResolvedTokens } from "../src/types/resolve.js";

const RESOLVERS = resolve(__dirname, "__fixtures__/resolver");
const config = { variables: {} } as never;

const NOT_COMPOSABLE = new Set(["with-extending", "private-sets", "private-source"]);
const NOT_LOADABLE = new Set([
    "circular-b",
    "invalid-reference",
    "invalid-source",
    "invalid-version",
    "single-context-modifier",
]);

async function both(resolverPath: string) {
    const loaded = await loadTokens({ type: "resolver", resolverPath, config });
    expect(loaded.errors).toEqual([]);
    if (!loaded.sources) throw new Error(`${resolverPath} reported no sources`);
    const composed = composeTrees(loaded.sources);
    return {
        composed,
        truth: resolveTokens(loaded.trees).resolved,
        derived: resolveTokens(composed.trees).resolved,
    };
}

function sourcePathOf(map: ResolvedTokens, key: string): string | undefined {
    return (map[key] as { $source?: { sourcePath?: string } } | undefined)?.$source?.sourcePath;
}

describe("composeTrees", () => {
    const fixtures = [
        ...readdirSync(RESOLVERS)
            .filter((name) => name.endsWith(".resolver.json"))
            .map((name) => resolve(RESOLVERS, name)),
        resolve(RESOLVERS, "provenance/provenance.resolver.json"),
    ].filter((path) => {
        const name = basename(path, ".resolver.json");
        return !NOT_COMPOSABLE.has(name) && !NOT_LOADABLE.has(name);
    });

    for (const path of fixtures) {
        const name = basename(path, ".resolver.json");

        it(`${name}: matches the resolver`, async () => {
            const result = await both(path);

            expect(result.composed.errors).toEqual([]);
            expect(Object.keys(result.derived).sort()).toEqual(Object.keys(result.truth).sort());

            const fields = ["$value", "$description", "$type", "$extensions"] as const;
            const differences: string[] = [];
            for (const key of Object.keys(result.truth)) {
                for (const field of fields) {
                    const before = (result.truth[key] as Record<string, unknown>)?.[field];
                    const after = (result.derived[key] as Record<string, unknown>)?.[field];
                    if (JSON.stringify(before) !== JSON.stringify(after)) {
                        differences.push(`${key} ${field}`);
                    }
                }
            }
            expect(differences).toEqual([]);
        });

        it(`${name}: keeps every $sourcePath the resolver gave`, async () => {
            const result = await both(path);

            const regressions = Object.keys(result.truth).filter((key) => {
                const before = sourcePathOf(result.truth, key);
                const after = sourcePathOf(result.derived, key);
                return before !== after && !before?.endsWith(".resolver.json");
            });
            expect(regressions).toEqual([]);
        });
    }

    it("only takes the part of a file a pointer names", async () => {
        const result = await both(resolve(RESOLVERS, "provenance/provenance.resolver.json"));

        const keys = Object.keys(result.derived);
        expect(keys.some((key) => key.includes("unused"))).toBe(false);
        expect(keys.some((key) => key.endsWith("perm:0.duration.fast"))).toBe(true);
    });

    it("stamps inline tokens with the resolver and groups with their file", async () => {
        const result = await both(resolve(RESOLVERS, "provenance/provenance.resolver.json"));

        const pill = Object.keys(result.derived).find((key) => key.endsWith("radius.pill"));
        expect(sourcePathOf(result.derived, pill ?? "")).toContain("provenance.resolver.json");

        const group = Object.entries(result.derived).find(
            ([key, node]) => key.endsWith("perm:0.color.neutral") && !isResolvedToken(node),
        );
        expect(sourcePathOf(result.derived, group?.[0] ?? "")).toContain("color.json");
    });

    it("reports missing files and bad pointers and carries on", () => {
        const { trees, errors } = composeTrees({
            files: { "a.json": '{"color":{"bg":{"$type":"color","$value":"#fff"}}}' },
            order: [
                {
                    context: "default",
                    sources: [
                        { file: "a.json" },
                        { file: "missing.json" },
                        { file: "a.json", pointer: "/nowhere" },
                    ],
                },
            ],
        });

        expect(trees).toHaveLength(1);
        expect(errors.map((each) => each.path)).toEqual(["missing.json", "a.json"]);
    });

    it("reports a broken file once, not once per context", () => {
        const { trees, errors } = composeTrees({
            files: { "broken.json": "{ not json" },
            order: [
                { context: "perm:0", sources: [{ file: "broken.json" }] },
                { context: "perm:1", sources: [{ file: "broken.json" }] },
            ],
        });

        expect(trees).toEqual([]);
        expect(errors).toHaveLength(1);
        expect(errors[0]?.path).toBe("broken.json");
    });

    it("skips a context with no tokens", () => {
        const { trees } = composeTrees({
            files: { "empty.json": "{}" },
            order: [{ context: "default", sources: [{ file: "empty.json" }] }],
        });

        expect(trees).toEqual([]);
    });
});
