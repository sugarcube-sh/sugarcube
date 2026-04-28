import { describe, expect, it } from "vitest";
import { formatCSSVarName } from "../src/shared/format-css-var-name.js";

describe("formatCSSVarName", () => {
    it("joins dot-separated segments with hyphens", () => {
        expect(formatCSSVarName("color.blue.500")).toBe("color-blue-500");
    });

    it("drops a trailing .$root segment per DTCG 2025.10 §6.2", () => {
        expect(formatCSSVarName("color.accent.$root")).toBe("color-accent");
    });

    describe("whitespace in path segments", () => {
        it("trims trailing whitespace in a group segment (issue #91)", () => {
            // Input path `"color .blue"` comes from a group key like `"color "`
            // (trailing space typo). Today this emits `"color -blue"`, which
            // produces invalid CSS like `--color -blue: …`.
            expect(formatCSSVarName("color .blue")).toBe("color-blue");
        });

        it("trims leading whitespace in a group segment", () => {
            expect(formatCSSVarName(" color.blue")).toBe("color-blue");
        });

        it("collapses internal whitespace to a hyphen (DTCG §6.10.1 'acid green')", () => {
            // Per spec example 27/30, `"acid green"` is a legal token name and
            // is expected to translate to a kebab-cased identifier like
            // `--brand-color-acid-green`.
            expect(formatCSSVarName("brand.color.acid green")).toBe("brand-color-acid-green");
        });

        it("collapses runs of whitespace to a single hyphen", () => {
            expect(formatCSSVarName("brand.acid   green")).toBe("brand-acid-green");
        });
    });
});
