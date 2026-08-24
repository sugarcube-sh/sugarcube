import { describe, expect, it } from "vitest";
import { stacksOn } from "../src/shared/pipeline/stacks-on.js";

const MIN_640 = "@media (min-width: 640px)";
const MIN_1024 = "@media (min-width: 1024px)";
const MAX_640 = "@media (max-width: 640px)";
const MAX_1024 = "@media (max-width: 1024px)";

describe("stacksOn", () => {
    it("nests anything inside an unconditional block", () => {
        expect(stacksOn(undefined, MIN_640)).toBe(true);
        expect(stacksOn(undefined, MAX_640)).toBe(true);
        expect(stacksOn(undefined, undefined)).toBe(true);
    });

    it("does not nest an unconditional block inside a media query", () => {
        expect(stacksOn(MIN_640, undefined)).toBe(false);
    });

    it("nests a wider min-width inside a narrower one", () => {
        expect(stacksOn(MIN_640, MIN_1024)).toBe(true);
    });

    it("does not nest a narrower min-width inside a wider one", () => {
        expect(stacksOn(MIN_1024, MIN_640)).toBe(false);
    });

    it("nests a narrower max-width inside a wider one", () => {
        expect(stacksOn(MAX_1024, MAX_640)).toBe(true);
    });

    it("does not nest a wider max-width inside a narrower one", () => {
        expect(stacksOn(MAX_640, MAX_1024)).toBe(false);
    });

    it("does not nest equal widths", () => {
        expect(stacksOn(MIN_640, MIN_640)).toBe(false);
    });

    it("does not mix min-width with max-width", () => {
        expect(stacksOn(MIN_640, MAX_1024)).toBe(false);
        expect(stacksOn(MAX_1024, MIN_640)).toBe(false);
    });

    it("compares em and rem within their own unit", () => {
        expect(stacksOn("@media (min-width: 40em)", "@media (min-width: 64em)")).toBe(true);
        expect(stacksOn("@media (min-width: 64rem)", "@media (min-width: 40rem)")).toBe(false);
    });

    it("never compares across units", () => {
        expect(stacksOn(MIN_640, "@media (min-width: 40em)")).toBe(false);
        expect(stacksOn("@media (min-width: 40em)", MIN_1024)).toBe(false);
    });

    it("treats range syntax as the equivalent keyword bound", () => {
        expect(stacksOn(MIN_640, "@media (width >= 1024px)")).toBe(true);
        expect(stacksOn("@media (width >= 640px)", MIN_1024)).toBe(true);
        expect(stacksOn(MAX_1024, "@media (width < 640px)")).toBe(true);
    });

    it("tolerates whitespace and decimal widths", () => {
        expect(stacksOn("  @media ( min-width : 37.5px ) ", MIN_640)).toBe(true);
    });

    it.each([
        ["a media type", "@media screen and (min-width: 1024px)"],
        ["a compound query", "@media (min-width: 1024px) and (max-width: 1439px)"],
        ["a double-bounded range", "@media (640px <= width <= 1024px)"],
        ["prefers-color-scheme", "@media (prefers-color-scheme: dark)"],
        ["a container query", "@container (min-width: 1024px)"],
        ["a unitless width", "@media (min-width: 1024)"],
        ["an unsupported unit", "@media (min-width: 50vw)"],
        ["uppercase MEDIA", "@MEDIA (min-width: 1024px)"],
        ["min-height", "@media (min-height: 1024px)"],
        ["trailing junk", "@media (min-width: 1024px) {"],
    ])("does not nest %s", (_label, atRule) => {
        expect(stacksOn(MIN_640, atRule)).toBe(false);
        expect(stacksOn(atRule, MIN_1024)).toBe(false);
    });

    it("does not nest two mutually exclusive preference queries", () => {
        expect(
            stacksOn("@media (prefers-color-scheme: light)", "@media (prefers-color-scheme: dark)"),
        ).toBe(false);
    });
});
