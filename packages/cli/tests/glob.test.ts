import { describe, expect, it } from "vitest";
import { buildExtensionGlob } from "../src/glob.js";

describe("buildExtensionGlob", () => {
    it("builds a brace group for multiple extensions", () => {
        expect(buildExtensionGlob([".css", ".vue", ".svelte"])).toBe("**/*.{css,vue,svelte}");
    });

    it("does not wrap a single extension in braces (a lone {css} matches nothing)", () => {
        expect(buildExtensionGlob([".css"])).toBe("**/*.css");
    });

    it("strips leading dots and lowercases", () => {
        expect(buildExtensionGlob([".CSS", "Vue"])).toBe("**/*.{css,vue}");
    });

    it("de-dupes repeated extensions", () => {
        expect(buildExtensionGlob([".css", ".CSS", "css"])).toBe("**/*.css");
    });

    it("falls back to matching everything when given no extensions", () => {
        expect(buildExtensionGlob([])).toBe("**/*");
        expect(buildExtensionGlob(["", "."])).toBe("**/*");
    });
});
