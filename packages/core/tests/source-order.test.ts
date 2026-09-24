import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadTokens } from "../src/node/load-tokens.js";

const FIXTURE = resolve(__dirname, "__fixtures__/resolver/provenance");
const RESOLVER = resolve(FIXTURE, "provenance.resolver.json");
const config = { variables: {} } as never;
const at = (name: string) => relative(process.cwd(), resolve(FIXTURE, name));

describe("loadTokens sources", () => {
    it("has one entry per context, in the same order as the trees", async () => {
        const loaded = await loadTokens({ type: "resolver", resolverPath: RESOLVER, config });

        expect(loaded.errors).toEqual([]);
        expect(loaded.sources?.order.map((each) => each.context)).toEqual(
            loaded.trees.map((tree) => tree.context),
        );
    });

    it("lists the base sources in resolution order, with pointers where needed", async () => {
        const loaded = await loadTokens({ type: "resolver", resolverPath: RESOLVER, config });
        const base = loaded.sources?.order.find((each) => each.context === "perm:0");

        expect(base?.sources).toEqual([
            { file: at("color.json") },
            { file: at("space.json") },
            { file: at("provenance.resolver.json"), pointer: "/resolutionOrder/0/sources/2" },
            { file: at("extras.json"), pointer: "/motion" },
        ]);
    });

    it("puts the modifier's file last", async () => {
        const loaded = await loadTokens({ type: "resolver", resolverPath: RESOLVER, config });
        const dark = loaded.sources?.order.find((each) => each.context === "perm:1");

        expect(dark?.sources.at(-1)).toEqual({ file: at("dark.json") });
        expect(dark?.sources).toHaveLength(5);
    });

    it("includes the text of every file, unchanged", async () => {
        const loaded = await loadTokens({ type: "resolver", resolverPath: RESOLVER, config });
        const files = new Set(
            loaded.sources?.order.flatMap((each) => each.sources.map((ref) => ref.file)),
        );

        expect(Object.keys(loaded.sources?.files ?? {}).sort()).toEqual([...files].sort());
        for (const [file, text] of Object.entries(loaded.sources?.files ?? {})) {
            expect(text).toBe(readFileSync(resolve(process.cwd(), file), "utf8"));
        }
    });

    it("reports the default context", async () => {
        const loaded = await loadTokens({ type: "resolver", resolverPath: RESOLVER, config });

        expect(loaded.defaultContext).toBe("perm:0");
    });

    it("is undefined for a memory source", async () => {
        const loaded = await loadTokens({
            type: "memory",
            data: { "a.json": { content: '{"color":{"bg":{"$value":"#fff"}}}' } },
            config,
        });

        expect(loaded.sources).toBeUndefined();
        expect(loaded.defaultContext).toBeUndefined();
    });
});
