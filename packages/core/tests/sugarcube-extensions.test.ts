import { describe, expect, it } from "vitest";
import {
    getSugarcubeExtensions,
    usesPrefersColorScheme,
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

describe("usesPrefersColorScheme", () => {
    it("returns false when extensions is undefined", () => {
        expect(usesPrefersColorScheme(undefined)).toBe(false);
    });

    it("returns false when sh.sugarcube namespace is missing", () => {
        expect(usesPrefersColorScheme({})).toBe(false);
    });

    it("returns false when prefersColorScheme is not specified", () => {
        const extensions = {
            "sh.sugarcube": {},
        };
        expect(usesPrefersColorScheme(extensions)).toBe(false);
    });

    it("returns true when prefersColorScheme is true", () => {
        const extensions = {
            "sh.sugarcube": {
                prefersColorScheme: true,
            },
        };
        expect(usesPrefersColorScheme(extensions)).toBe(true);
    });

    it("returns false when prefersColorScheme is false", () => {
        const extensions = {
            "sh.sugarcube": {
                prefersColorScheme: false,
            },
        };
        expect(usesPrefersColorScheme(extensions)).toBe(false);
    });
});
