import { describe, expect, it } from "vitest";
import { findDangling, findUnused, scanCSS } from "../src/lint/scan-css.js";

describe("scanCSS", () => {
    it("collects custom-property declarations", () => {
        const { declared } = scanCSS(":root { --color-primary: red; --space-md: 1rem; }", "a.css");
        expect([...declared].sort()).toEqual(["--color-primary", "--space-md"]);
    });

    it("collects var() references with their line numbers", () => {
        const css = ".a { color: var(--color-primary); }";
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
});

describe("findDangling", () => {
    const declared = new Set(["--color-primary", "--space-md"]);

    it("puts undeclared, no-fallback refs in broken", () => {
        const used = [
            { name: "--color-primary", line: 1, file: "a.css" },
            { name: "--color-old", line: 2, file: "a.css" },
        ];
        const { broken, masked } = findDangling(used, declared, []);
        expect(broken).toEqual([{ name: "--color-old", line: 2, file: "a.css" }]);
        expect(masked).toEqual([]);
    });

    it("puts undeclared refs that have a fallback in masked, not broken", () => {
        const used = [{ name: "--color-old", line: 1, file: "a.css", hasFallback: true }];
        const { broken, masked } = findDangling(used, declared, []);
        expect(broken).toEqual([]);
        expect(masked).toHaveLength(1);
    });

    it("does not flag references that are declared", () => {
        const used = [{ name: "--space-md", line: 1, file: "a.css" }];
        const { broken, masked } = findDangling(used, declared, []);
        expect(broken).toEqual([]);
        expect(masked).toEqual([]);
    });

    it("flags private --_ vars when undeclared (they are still vars)", () => {
        const used = [{ name: "--_button-color", line: 1, file: "a.css" }];
        expect(findDangling(used, declared, []).broken).toHaveLength(1);
    });

    it("drops names matching an ignore prefix", () => {
        const used = [{ name: "--tw-ring-color", line: 1, file: "a.css" }];
        const { broken, masked } = findDangling(used, declared, ["--tw-"]);
        expect(broken).toEqual([]);
        expect(masked).toEqual([]);
    });

    it("de-dupes identical findings", () => {
        const used = [
            { name: "--gone", line: 5, file: "a.css" },
            { name: "--gone", line: 5, file: "a.css" },
        ];
        expect(findDangling(used, declared, []).broken).toHaveLength(1);
    });
});

describe("findUnused", () => {
    it("returns declared names that are never referenced, sorted", () => {
        const declared = new Set(["--b-token", "--a-token", "--used"]);
        const used = [{ name: "--used", line: 1, file: "a.css" }];
        expect(findUnused(declared, used, [])).toEqual(["--a-token", "--b-token"]);
    });

    it("respects ignore prefixes", () => {
        const declared = new Set(["--sl-x", "--gone"]);
        expect(findUnused(declared, [], ["--sl-"])).toEqual(["--gone"]);
    });
});
