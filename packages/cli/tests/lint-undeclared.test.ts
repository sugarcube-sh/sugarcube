import { describe, expect, it } from "vitest";
import { findUndeclared } from "../src/lint/undeclared.js";

describe("findUndeclared", () => {
    const declared = new Set(["--color-primary", "--space-md"]);

    it("puts undeclared, no-fallback refs in broken", () => {
        const used = [
            { name: "--color-primary", line: 1, file: "a.css" },
            { name: "--color-old", line: 2, file: "a.css" },
        ];
        const { broken, fallback } = findUndeclared(used, declared, []);
        expect(broken).toEqual([{ name: "--color-old", line: 2, file: "a.css" }]);
        expect(fallback).toEqual([]);
    });

    it("puts undeclared refs that have a fallback in fallback, not broken", () => {
        const used = [{ name: "--color-old", line: 1, file: "a.css", hasFallback: true }];
        const { broken, fallback } = findUndeclared(used, declared, []);
        expect(broken).toEqual([]);
        expect(fallback).toHaveLength(1);
    });

    it("does not flag references that are declared", () => {
        const used = [{ name: "--space-md", line: 1, file: "a.css" }];
        const { broken, fallback } = findUndeclared(used, declared, []);
        expect(broken).toEqual([]);
        expect(fallback).toEqual([]);
    });

    it("flags private --_ vars when undeclared (they are still vars)", () => {
        const used = [{ name: "--_button-color", line: 1, file: "a.css" }];
        expect(findUndeclared(used, declared, []).broken).toHaveLength(1);
    });

    it("drops names matching an ignore prefix", () => {
        const used = [{ name: "--tw-ring-color", line: 1, file: "a.css" }];
        const { broken, fallback } = findUndeclared(used, declared, ["--tw-"]);
        expect(broken).toEqual([]);
        expect(fallback).toEqual([]);
    });

    it("de-dupes identical findings", () => {
        const used = [
            { name: "--gone", line: 5, file: "a.css" },
            { name: "--gone", line: 5, file: "a.css" },
        ];
        expect(findUndeclared(used, declared, []).broken).toHaveLength(1);
    });
});
