import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadTokens } from "../src/node/load-tokens.js";

const FIXTURE = resolve(__dirname, "__fixtures__/resolver/provenance");
const RESOLVER = resolve(FIXTURE, "provenance.resolver.json");
const config = { variables: {} } as never;
const at = (name: string) => relative(process.cwd(), resolve(FIXTURE, name));

describe("loadTokens reports which sources composed each context", () => {
    it("gives one entry per context, matching the trees", async () => {
        const loaded = await loadTokens({ type: "resolver", resolverPath: RESOLVER, config });

        expect(loaded.errors).toEqual([]);
        expect(loaded.sources?.order.map((each) => each.context)).toEqual(
            loaded.trees.map((tree) => tree.context),
        );
    });

    it("lists the base sources for the default context, in resolution order", async () => {
        const loaded = await loadTokens({ type: "resolver", resolverPath: RESOLVER, config });
        const base = loaded.sources?.order.find((each) => each.context === "perm:0");

        expect(base?.sources).toEqual([
            { file: at("color.json") },
            { file: at("space.json") },
            { file: at("provenance.resolver.json"), pointer: "/resolutionOrder/0/sources/2" },
            { file: at("extras.json"), pointer: "/motion" },
        ]);
    });

    it("adds the modifier's own file last, so it wins", async () => {
        const loaded = await loadTokens({ type: "resolver", resolverPath: RESOLVER, config });
        const dark = loaded.sources?.order.find((each) => each.context === "perm:1");

        expect(dark?.sources.at(-1)).toEqual({ file: at("dark.json") });
        expect(dark?.sources).toHaveLength(5);
    });

    it("names files in the same form as $source.sourcePath", async () => {
        const loaded = await loadTokens({ type: "resolver", resolverPath: RESOLVER, config });
        const files = new Set(
            loaded.sources?.order.flatMap((each) => each.sources.map((ref) => ref.file)),
        );

        for (const tree of loaded.trees) {
            for (const [, stamped] of JSON.stringify(tree.tokens).matchAll(
                /"\$sourcePath":"([^"]+)"/g,
            )) {
                expect(files).toContain(stamped);
            }
        }
    });

    it("carries the text of every file in the order, as it is on disk", async () => {
        const loaded = await loadTokens({ type: "resolver", resolverPath: RESOLVER, config });
        const files = new Set(
            loaded.sources?.order.flatMap((each) => each.sources.map((ref) => ref.file)),
        );

        expect(Object.keys(loaded.sources?.files ?? {}).sort()).toEqual([...files].sort());
        for (const [file, text] of Object.entries(loaded.sources?.files ?? {})) {
            expect(text).toBe(readFileSync(resolve(process.cwd(), file), "utf8"));
        }
    });

    it("names the default context, read off the resolver", async () => {
        const loaded = await loadTokens({ type: "resolver", resolverPath: RESOLVER, config });

        expect(loaded.defaultContext).toBe("perm:0");
    });

    it("says nothing for a memory source, which has no resolution order", async () => {
        const loaded = await loadTokens({
            type: "memory",
            data: { "a.json": { content: '{"color":{"bg":{"$value":"#fff"}}}' } },
            config,
        });

        expect(loaded.sources).toBeUndefined();
        expect(loaded.defaultContext).toBeUndefined();
    });
});
