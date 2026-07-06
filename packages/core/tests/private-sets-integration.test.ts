import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/node/config/normalize";
import { loadTokens } from "../src/node/load-tokens";
import { generateCSSVariables } from "../src/shared/generate-css-variables";
import { assignCSSNames } from "../src/shared/pipeline/assign-css-names";
import { groupByContext } from "../src/shared/pipeline/group-by-context";
import { inlinePrivateReferences } from "../src/shared/pipeline/inline-private-references";
import { resolveTokens } from "../src/shared/resolve-tokens";
import type { ResolvedToken, ResolvedTokens } from "../src/types/resolve";

const FIXTURE = "tests/__fixtures__/resolver/private-sets.resolver.json";

function byPath(resolved: ResolvedTokens, path: string): ResolvedToken | undefined {
    return Object.values(resolved).find(
        (node): node is ResolvedToken => "$path" in node && (node as ResolvedToken).$path === path,
    );
}

describe("private sets — resolver → flatten → inline", () => {
    it("stamps emit:false from $extensions, then drops the private token and inlines the reference", async () => {
        const config = validateConfig({});
        const loaded = await loadTokens({ type: "resolver", resolverPath: FIXTURE, config });
        const { resolved, errors } = resolveTokens(loaded.trees);

        expect(loaded.errors).toHaveLength(0);
        expect(errors.resolution).toHaveLength(0);

        expect(byPath(resolved, "rose.600")?.$source.emit).toBe(false);
        expect(byPath(resolved, "color.danger")?.$source.emit).toBeUndefined();

        const inlined = inlinePrivateReferences(resolved);

        expect(byPath(inlined, "rose.600")).toBeUndefined();
        expect(byPath(inlined, "color.danger")?.$value).toBe("#e11d48");

        expect(byPath(resolved, "rose.600")).toBeDefined();
        expect(byPath(resolved, "color.danger")?.$value).toBe("{rose.600}");
    });

    it("renders the inlined literal and leaks no var() to the private token", async () => {
        const config = validateConfig({});
        const loaded = await loadTokens({ type: "resolver", resolverPath: FIXTURE, config });
        const { resolved } = resolveTokens(loaded.trees);

        const renderable = assignCSSNames(groupByContext(loaded.trees, resolved), config);
        const css = JSON.stringify(
            await generateCSSVariables(renderable, config, loaded.permutations),
        );

        expect(css).toContain("#e11d48");
        expect(css).not.toContain("rose-600");
    });

    it("supports source-level emit:false (a private source inside a public set)", async () => {
        const config = validateConfig({});
        const loaded = await loadTokens({
            type: "resolver",
            resolverPath: "tests/__fixtures__/resolver/private-source.resolver.json",
            config,
        });
        const { resolved, errors } = resolveTokens(loaded.trees);

        expect(loaded.errors).toHaveLength(0);
        expect(errors.resolution).toHaveLength(0);

        // Only the private source's tokens are marked, not the public source's.
        expect(byPath(resolved, "rose.600")?.$source.emit).toBe(false);
        expect(byPath(resolved, "color.danger")?.$source.emit).toBeUndefined();

        const renderable = assignCSSNames(groupByContext(loaded.trees, resolved), config);
        const css = JSON.stringify(
            await generateCSSVariables(renderable, config, loaded.permutations),
        );

        expect(css).toContain("#e11d48");
        expect(css).not.toContain("rose-600");
    });
});
