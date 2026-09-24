import { join } from "node:path";
import {
    type ResolvedTokens,
    type TokenSources,
    type TokenTree,
    composeTrees,
    isResolvedToken,
    resolveTokens,
} from "@sugarcube-sh/core/client";
import { loadTokens } from "@sugarcube-sh/core";
import { beforeAll, describe, expect, it } from "vitest";

const RESOLVER = join(__dirname, "../demo/tokens.resolver.json");

type Sourced = { $source?: { sourcePath?: string } };
const fileOf = (node: unknown) => (node as Sourced | undefined)?.$source?.sourcePath;

describe("deriving the document from file text", () => {
    let truth: ResolvedTokens;
    let derived: ResolvedTokens;
    let trees: TokenTree[];
    let errors: ReturnType<typeof composeTrees>["errors"];

    beforeAll(async () => {
        const loaded = await loadTokens({
            type: "resolver",
            resolverPath: RESOLVER,
            config: { variables: {} } as never,
        });
        truth = resolveTokens(loaded.trees).resolved;
        ({ trees, errors } = composeTrees(loaded.sources as TokenSources));
        derived = resolveTokens(trees).resolved;
    });

    it("composes without error", () => {
        expect(errors).toEqual([]);
        expect(trees.length).toBeGreaterThan(0);
    });

    it("reaches the same document the resolver path does", () => {
        expect(Object.keys(derived).sort()).toEqual(Object.keys(truth).sort());

        // Every field, not just $value. Comparing $value alone let a real
        // regression through: composing one tree per file made flatten replace
        // group nodes on key collision, dropping a base group's $description in
        // any context that overrode something inside it.
        const fields = ["$value", "$description", "$type", "$extensions"] as const;
        const differences: string[] = [];
        for (const key of Object.keys(truth)) {
            for (const field of fields) {
                const before = (truth[key] as Record<string, unknown>)?.[field];
                const after = (derived[key] as Record<string, unknown>)?.[field];
                if (JSON.stringify(before) !== JSON.stringify(after)) {
                    differences.push(`${key} ${field}`);
                }
            }
        }
        expect(differences).toEqual([]);
    });

    it("knows which file every node came from, which the resolver path does not", () => {
        const claimsResolver = (map: ResolvedTokens) =>
            Object.keys(map).filter((key) => fileOf(map[key])?.endsWith("tokens.resolver.json"));

        expect(claimsResolver(truth).length).toBeGreaterThan(0);
        expect(claimsResolver(derived)).toEqual([]);
    });

    it("never makes provenance worse than the resolver path", () => {
        const regressions = Object.keys(truth).filter((key) => {
            const before = fileOf(truth[key]);
            return before !== fileOf(derived[key]) && !before?.endsWith("tokens.resolver.json");
        });

        expect(regressions).toEqual([]);
    });

    it("gives a group the file it was authored in", () => {
        const group = Object.entries(derived).find(
            ([key, node]) => key.endsWith(".color.brand") && !isResolvedToken(node),
        );

        expect(fileOf(group?.[1])).toContain("color.json");
    });
});
