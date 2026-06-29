import { describe, expect, it } from "vitest";
import { scanCSS } from "../src/lint/scan-css.js";
import { createSyntaxResolver } from "../src/lint/syntaxes.js";

async function parserFor(file: string) {
    const res = await createSyntaxResolver().resolve(file);
    if (res.kind !== "parser") throw new Error(`expected a parser for ${file}, got ${res.kind}`);
    return res.parse;
}

describe("createSyntaxResolver", () => {
    it("uses plain CSS for .css", async () => {
        const res = await createSyntaxResolver().resolve("a.css");
        expect(res.kind).toBe("parser");
    });

    it("resolves a parser for every default component type", async () => {
        for (const file of ["a.vue", "a.svelte", "a.astro", "a.html"]) {
            const res = await createSyntaxResolver().resolve(file);
            expect(res.kind, file).toBe("parser");
        }
    });

    it("reports missing when the syntax module isn't installed", async () => {
        const resolver = createSyntaxResolver({ ".marko": "a-syntax-that-isnt-installed" });
        expect(await resolver.resolve("x.marko")).toEqual({
            kind: "missing",
            module: "a-syntax-that-isnt-installed",
        });
    });

    it("reports unsupported for unknown extensions", async () => {
        expect(await createSyntaxResolver().resolve("notes.txt")).toEqual({
            kind: "unsupported",
            ext: ".txt",
        });
    });

    it("exposes css plus every configured extension for globbing", () => {
        const exts = createSyntaxResolver().extensions();
        expect(exts).toContain(".css");
        expect(exts).toContain(".vue");
        expect(exts).toContain(".astro");
    });

    it("lets overrides add an extension the defaults don't cover", () => {
        expect(createSyntaxResolver({ ".marko": "postcss-html" }).extensions()).toContain(".marko");
    });
});

describe("scanCSS with a component parser", () => {
    it("maps references to their original file line inside a <style> block", async () => {
        const parse = await parserFor("Hero.vue");
        const vue = [
            "<template>", // 1
            '  <div class="hero" />', // 2
            "</template>", // 3
            "", // 4
            "<style>", // 5
            ".hero {", // 6
            "  color: var(--color-primary);", // 7
            "  background: var(--bg, white);", // 8
            "}", // 9
            "</style>",
        ].join("\n");

        const { used } = scanCSS(vue, "Hero.vue", parse);
        expect(used.map((u) => [u.name, u.line])).toEqual([
            ["--color-primary", 7],
            ["--bg", 8],
        ]);
    });

    it("walks multiple <style> blocks (postcss-html Document)", async () => {
        const parse = await parserFor("Two.html");
        const html = [
            "<style>", // 1
            "  .a { color: var(--one); }", // 2
            "</style>", // 3
            "<div></div>", // 4
            "<style>", // 5
            "  .b { color: var(--two); }", // 6
            "</style>",
        ].join("\n");

        const { used } = scanCSS(html, "Two.html", parse);
        expect(used.map((u) => u.name)).toEqual(["--one", "--two"]);
        expect(used.map((u) => u.line)).toEqual([2, 6]);
    });
});
