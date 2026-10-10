import { describe, expect, it } from "vitest";
import { scanCSS } from "../src/scan-css.js";

describe("scanCSS", () => {
    it("collects custom-property declarations", () => {
        const { declared } = scanCSS(":root { --color-primary: red; --space-md: 1rem; }", "a.css");
        expect([...declared].sort()).toEqual(["--color-primary", "--space-md"]);
    });

    it("collects var() references with their line numbers", () => {
        const css = ".a {\n  color: var(--color-primary);\n}";
        const { used } = scanCSS(css, "a.css");
        expect(used).toEqual([
            { name: "--color-primary", line: 2, file: "a.css", hasFallback: false },
        ]);
    });

    it("captures both names in a nested var() fallback", () => {
        const { used } = scanCSS(".a { color: var(--a, var(--b)); }", "a.css");
        expect(used.map((u) => u.name)).toEqual(["--a", "--b"]);
    });

    it("flags whether a reference has a fallback", () => {
        const { used } = scanCSS(".a { color: var(--a, var(--b)); }", "a.css");
        expect(used).toEqual([
            { name: "--a", line: 1, file: "a.css", hasFallback: true },
            { name: "--b", line: 1, file: "a.css", hasFallback: false },
        ]);
    });

    it("treats a declared var as both a declaration and ignores its own name as a ref", () => {
        const { declared, used } = scanCSS(".a { --x: var(--y); }", "a.css");
        expect([...declared]).toEqual(["--x"]);
        expect(used.map((u) => u.name)).toEqual(["--y"]);
    });

    it("is case-insensitive about the var() function name", () => {
        const { used } = scanCSS(".a { color: VAR(--a); border-color: Var(--b); }", "a.css");
        expect(used.map((u) => u.name)).toEqual(["--a", "--b"]);
    });

    it("tolerates arbitrary whitespace and newlines inside var()", () => {
        const css = ".a {\n  color: var(\n    --a\n    ,\n    var( --b )\n  );\n}";
        const { used } = scanCSS(css, "a.css");
        expect(used.map((u) => u.name)).toEqual(["--a", "--b"]);
        expect(used[0]?.hasFallback).toBe(true);
        expect(used[1]?.hasFallback).toBe(false);
    });

    it("reports the line of the reference within a multi-line value", () => {
        const css = ".a {\n  grid-template:\n    var(--rows)\n    / var(--cols);\n}";
        const { used } = scanCSS(css, "a.css");
        expect(used).toEqual([
            { name: "--rows", line: 3, file: "a.css", hasFallback: false },
            { name: "--cols", line: 4, file: "a.css", hasFallback: false },
        ]);
    });

    it("ignores function names that merely contain 'var'", () => {
        const { used } = scanCSS(".a { width: calc(var(--a) + 1px); --avar: 0; }", "a.css");
        expect(used.map((u) => u.name)).toEqual(["--a"]);
    });

    it("handles escaped characters in custom-property names", () => {
        const { used } = scanCSS(".a { color: var(--my\\.color); }", "a.css");
        expect(used.map((u) => u.name)).toEqual(["--my\\.color"]);
    });
});
