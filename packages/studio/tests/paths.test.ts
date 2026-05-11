import { describe, expect, it } from "vitest";
import { resolveTerminalPath, unwrapRef } from "../src/tokens/paths";

describe("unwrapRef", () => {
    it("returns undefined when the value is not a string", () => {
        expect(unwrapRef(undefined)).toBeUndefined();
        expect(unwrapRef(null)).toBeUndefined();
        expect(unwrapRef(42)).toBeUndefined();
        expect(unwrapRef({})).toBeUndefined();
    });

    it("returns undefined when the string is not wrapped in braces", () => {
        expect(unwrapRef("font.body")).toBeUndefined();
        expect(unwrapRef("#fff")).toBeUndefined();
        expect(unwrapRef("")).toBeUndefined();
    });

    it("returns the inner path for a wrapped reference", () => {
        expect(unwrapRef("{font.body}")).toBe("font.body");
    });

    it("trims outer whitespace before checking the wrapping", () => {
        expect(unwrapRef("  {font.body}  ")).toBe("font.body");
    });

    it("trims inner whitespace inside the braces", () => {
        expect(unwrapRef("{ font.body }")).toBe("font.body");
    });

    it("returns undefined for empty content inside the braces", () => {
        expect(unwrapRef("{}")).toBeUndefined();
        expect(unwrapRef("{ }")).toBeUndefined();
    });

    it("returns undefined for an unbalanced reference string", () => {
        expect(unwrapRef("{font.body")).toBeUndefined();
        expect(unwrapRef("font.body}")).toBeUndefined();
    });
});

describe("resolveTerminalPath", () => {
    it("returns the input path when the value is not a reference", () => {
        const getToken = (path: string) => ({ "font.body": "Inter" })[path];
        expect(resolveTerminalPath("font.body", getToken)).toBe("font.body");
    });

    it("follows a single-step reference to its target", () => {
        const getToken = (path: string) =>
            ({ "font.body": "{font.sans}", "font.sans": "Inter" })[path];
        expect(resolveTerminalPath("font.body", getToken)).toBe("font.sans");
    });

    it("walks a multi-hop reference chain to the terminal", () => {
        const getToken = (path: string) =>
            ({
                "font.body": "{font.serif}",
                "font.serif": "{font.sans}",
                "font.sans": "Inter",
            })[path];
        expect(resolveTerminalPath("font.body", getToken)).toBe("font.sans");
    });

    it("stops at the cycle entry when a path references itself", () => {
        const getToken = (path: string) => ({ "font.loop": "{font.loop}" })[path];
        expect(resolveTerminalPath("font.loop", getToken)).toBe("font.loop");
    });

    it("stops at the cycle entry when references cycle between multiple paths", () => {
        const getToken = (path: string) => ({ "font.a": "{font.b}", "font.b": "{font.a}" })[path];
        expect(resolveTerminalPath("font.a", getToken)).toBe("font.a");
    });
});
