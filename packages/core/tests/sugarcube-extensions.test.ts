import { describe, expect, it } from "vitest";
import {
    getAtRule,
    getSelector,
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

describe("getSelector", () => {
    it("returns undefined when extensions is undefined", () => {
        expect(getSelector(undefined)).toBeUndefined();
    });

    it("returns undefined when sh.sugarcube namespace is missing", () => {
        expect(getSelector({})).toBeUndefined();
    });

    it("returns undefined when selector is not specified", () => {
        const extensions = {
            "sh.sugarcube": {},
        };
        expect(getSelector(extensions)).toBeUndefined();
    });

    it("returns selector pattern when specified", () => {
        const extensions = {
            "sh.sugarcube": {
                selector: '[data-theme="{context}"]',
            },
        };
        expect(getSelector(extensions)).toBe('[data-theme="{context}"]');
    });
});

describe("getAtRule", () => {
    it("returns undefined when extensions is undefined", () => {
        expect(getAtRule(undefined)).toBeUndefined();
    });

    it("returns undefined when sh.sugarcube namespace is missing", () => {
        expect(getAtRule({})).toBeUndefined();
    });

    it("returns undefined when atRule is not specified", () => {
        const extensions = {
            "sh.sugarcube": {},
        };
        expect(getAtRule(extensions)).toBeUndefined();
    });

    it("returns atRule pattern when specified", () => {
        const extensions = {
            "sh.sugarcube": {
                atRule: "@media (prefers-color-scheme: {context})",
            },
        };
        expect(getAtRule(extensions)).toBe("@media (prefers-color-scheme: {context})");
    });

    it("returns prefers-color-scheme atRule for backwards compat when prefersColorScheme is true", () => {
        const extensions = {
            "sh.sugarcube": {
                prefersColorScheme: true,
            },
        };
        expect(getAtRule(extensions)).toBe("@media (prefers-color-scheme: {context})");
    });

    it("returns undefined when prefersColorScheme is false", () => {
        const extensions = {
            "sh.sugarcube": {
                prefersColorScheme: false,
            },
        };
        expect(getAtRule(extensions)).toBeUndefined();
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
