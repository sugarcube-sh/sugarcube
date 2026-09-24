import { describe, expect, it } from "vitest";
import { ancestorsOf, hrefFor, pathFromPathname } from "../src/app/token-path";

describe("a token path as a URL", () => {
    it("is one segment per name", () => {
        expect(hrefFor("color.brand.500")).toBe("/color/brand/500");
        expect(pathFromPathname("/color/brand/500")).toBe("color.brand.500");
    });

    it("carries a name the spec allows and the URL would otherwise split", () => {
        const href = hrefFor("size.1/2.step");
        expect(href).toBe("/size/1%2F2/step");
        expect(pathFromPathname(href)).toBe("size.1/2.step");
        expect(ancestorsOf(href)).toEqual(["size", "size.1/2"]);
    });

    it("is nothing at the root", () => {
        expect(pathFromPathname("/")).toBeUndefined();
        expect(ancestorsOf("/color")).toEqual([]);
    });
});
