import { describe, expect, it } from "vitest";
import { getAncestorPaths, toHref, toTokenPath } from "../src/app/token-path";

describe("a token path as a URL", () => {
    it("is one segment per name", () => {
        expect(toHref("color.brand.500")).toBe("/color/brand/500");
        expect(toTokenPath("/color/brand/500")).toBe("color.brand.500");
    });

    it("carries a name the spec allows and the URL would otherwise split", () => {
        const href = toHref("size.1/2.step");
        expect(href).toBe("/size/1%2F2/step");
        expect(toTokenPath(href)).toBe("size.1/2.step");
        expect(getAncestorPaths(href)).toEqual(["size", "size.1/2"]);
    });

    it("is nothing at the root", () => {
        expect(toTokenPath("/")).toBeUndefined();
        expect(getAncestorPaths("/color")).toEqual([]);
    });
});
