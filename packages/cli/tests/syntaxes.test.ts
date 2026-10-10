import type { Parser } from "postcss";
import { describe, expect, it } from "vitest";
import { scanCSS } from "../src/scan-css.js";
import { STYLESHEET_EXTENSIONS, parserFor } from "../src/syntaxes.js";

function parser(file: string): Parser {
    const parse = parserFor(file);
    if (!parse) throw new Error(`expected a parser for ${file}`);
    return parse;
}

describe("parserFor", () => {
    it("has a parser for .css and every component type", () => {
        for (const file of ["a.css", "a.vue", "a.svelte", "a.astro", "a.html", "a.htm", "a.php"]) {
            expect(parserFor(file), file).toBeDefined();
        }
    });

    it("has none for unknown extensions", () => {
        expect(parserFor("notes.txt")).toBeUndefined();
    });

    it("has none for extensions we don't ship a parser for", () => {
        expect(parserFor("styles.scss")).toBeUndefined();
    });

    it("reads the extension whatever its case", () => {
        expect(parserFor("A.CSS")).toBeDefined();
    });
});

describe("STYLESHEET_EXTENSIONS", () => {
    it("lists css and every component type, for globbing", () => {
        expect(STYLESHEET_EXTENSIONS).toContain(".css");
        expect(STYLESHEET_EXTENSIONS).toContain(".vue");
        expect(STYLESHEET_EXTENSIONS).toContain(".astro");
    });
});

describe("scanCSS with a component parser", () => {
    it("maps references to their original file line inside a <style> block", () => {
        const parse = parser("Hero.vue");
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

    it("walks multiple <style> blocks (postcss-html Document)", () => {
        const parse = parser("Two.html");
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
