import { describe, expect, it } from "vitest";
import { searchHits } from "../src/app/search-hits";
import { openDocument, rename } from "../src/tokens/source-document";
import { sources } from "./text-sources";

describe("finding a token", () => {
    const doc = openDocument(sources());

    it("finds by the current path, with a swatch for a colour", () => {
        const { hits } = searchHits(doc.index, doc.resolved, "perm:0", "brand.500");

        expect(hits.map((hit) => hit.path)).toContain("color.brand.500");
        expect(hits.find((hit) => hit.path === "color.brand.500")?.swatch).toBeDefined();
    });

    it("finds a renamed token under its new name, and not its old one", () => {
        const renamed = rename(doc, "color.brand", "primary");
        if (!renamed) throw new Error("rename returned null");

        const now = searchHits(renamed.index, renamed.resolved, "perm:0", "primary.500");
        const before = searchHits(renamed.index, renamed.resolved, "perm:0", "brand.500");

        expect(now.hits.map((hit) => hit.path)).toContain("color.primary.500");
        expect(now.hits.find((hit) => hit.path === "color.primary.500")?.swatch).toBeDefined();
        expect(before.hits).toEqual([]);
    });

    it("keeps the swatch of a token that refers to a renamed one", () => {
        const renamed = rename(doc, "color.brand", "primary");
        if (!renamed) throw new Error("rename returned null");

        const { hits } = searchHits(renamed.index, renamed.resolved, "perm:0", "text.brand");

        expect(hits.find((hit) => hit.path === "color.text.brand")?.swatch).toBeDefined();
    });

    it("says when it stopped listing", () => {
        const { hits, capped } = searchHits(doc.index, doc.resolved, "perm:0", "color", 5);

        expect(hits).toHaveLength(5);
        expect(capped).toBe(true);
    });
});
