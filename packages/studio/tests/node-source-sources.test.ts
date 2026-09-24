import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { InternalConfig } from "@sugarcube-sh/core";
import { describe, expect, it } from "vitest";
import { createNodeTokenSource } from "../src/server/token-source";
import { composeTrees } from "@sugarcube-sh/core/client";
import { openDocument } from "../src/tokens/source-document";

const TOKENS = join(__dirname, "../demo");

const RESOLVER = relative(process.cwd(), join(TOKENS, "tokens.resolver.json"));

// The package's own config declares permutations for its own resolver, and
// those fail validation against the demo's modifiers.
const CONFIG = { variables: {}, resolver: RESOLVER } as unknown as InternalConfig;

async function source() {
    const node = createNodeTokenSource({
        loadConfig: async () => CONFIG,
        readFileText: (path) => readFile(path, "utf-8"),
    });
    await node.ready;
    return node;
}

describe("the host hands over the files themselves", () => {
    it("reads every file each context composes from", async () => {
        const node = await source();

        expect(node.sources).not.toBeNull();
        expect(node.sources?.order.map((each) => each.context)).toEqual(["perm:0", "perm:1"]);
        for (const { sources } of node.sources?.order ?? []) {
            for (const { file } of sources) {
                expect(typeof node.sources?.files[file]).toBe("string");
            }
        }
    });

    it("sends each file's text once, however many contexts use it", async () => {
        const node = await source();
        const mentioned = (node.sources?.order ?? []).flatMap((each) =>
            each.sources.map((ref) => ref.file),
        );

        expect(mentioned.length).toBeGreaterThan(Object.keys(node.sources?.files ?? {}).length);
    });

    it("is smaller on the wire than the resolved map it replaces", async () => {
        const node = await source();
        const text = JSON.stringify(node.sources).length;
        const derived = JSON.stringify(node.resolved).length + JSON.stringify(node.trees).length;

        expect(text).toBeLessThan(derived);
    });

    it("derives the document the host already computed", async () => {
        const node = await source();
        const derived = composeTrees(node.sources as NonNullable<typeof node.sources>);
        const doc = openDocument(node.sources as NonNullable<typeof node.sources>);

        expect(derived.errors).toEqual([]);
        expect(Object.keys(doc.resolved).sort()).toEqual(Object.keys(node.resolved ?? {}).sort());
    });

    it("opens a working store straight off what the host sent", async () => {
        const node = await source();
        const doc = openDocument(node.sources as NonNullable<typeof node.sources>);

        expect(doc.index.pathOf("color.brand.500")).toBe("color.brand.500");
        expect(doc.index.readValue(doc.resolved, "color.brand.500", "perm:0")).toBeDefined();
    });
});
