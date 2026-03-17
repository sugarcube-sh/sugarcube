import { describe, expect, it } from "vitest";
import {
    extractSelectorStrategy,
    getSugarcubeExtensions,
} from "../src/extensions/sugarcube-extensions.js";

describe("getSugarcubeExtensions", () => {
    it("returns undefined when extensions is undefined", () => {
        expect(getSugarcubeExtensions(undefined)).toBeUndefined();
    });

    it("returns undefined when sh.sugarcube namespace is missing", () => {
        expect(getSugarcubeExtensions({})).toBeUndefined();
        expect(getSugarcubeExtensions({ "other.namespace": {} })).toBeUndefined();
    });

    it("returns sugarcube extensions when present", () => {
        const extensions = {
            "sh.sugarcube": {
                prefersColorScheme: true,
            },
        };

        const result = getSugarcubeExtensions(extensions);
        expect(result).toEqual({ prefersColorScheme: true });
    });
});

describe("extractSelectorStrategy", () => {
    it("returns 'data-attribute' when extensions is undefined", () => {
        expect(extractSelectorStrategy(undefined)).toBe("data-attribute");
    });

    it("returns 'data-attribute' when sh.sugarcube namespace is missing", () => {
        expect(extractSelectorStrategy({})).toBe("data-attribute");
    });

    it("returns 'data-attribute' when prefersColorScheme is not specified", () => {
        const extensions = {
            "sh.sugarcube": {},
        };
        expect(extractSelectorStrategy(extensions)).toBe("data-attribute");
    });

    it("returns 'prefers-color-scheme' when prefersColorScheme is true", () => {
        const extensions = {
            "sh.sugarcube": {
                prefersColorScheme: true,
            },
        };
        expect(extractSelectorStrategy(extensions)).toBe("prefers-color-scheme");
    });

    it("returns 'data-attribute' when prefersColorScheme is false", () => {
        const extensions = {
            "sh.sugarcube": {
                prefersColorScheme: false,
            },
        };
        expect(extractSelectorStrategy(extensions)).toBe("data-attribute");
    });
});
