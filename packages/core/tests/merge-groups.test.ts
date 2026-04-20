import { describe, expect, it } from "vitest";
import { mergeGroups } from "../src/shared/pipeline/merge-groups.js";

describe("mergeGroups", () => {
    it("inherits all tokens from base when local is empty", () => {
        const base = {
            $type: "color" as const,
            background: { $value: "#0066cc" },
            text: { $value: "#ffffff" },
        };
        const local = {};

        const result = mergeGroups(base, local);

        expect(result.$type).toBe("color");
        expect(result.background).toEqual({ $value: "#0066cc" });
        expect(result.text).toEqual({ $value: "#ffffff" });
    });

    it("local tokens override base tokens at same path", () => {
        const base = {
            background: { $value: "#0066cc" },
            text: { $value: "#ffffff" },
        };
        const local = {
            background: { $value: "#cc0066" },
        };

        const result = mergeGroups(base, local);

        expect(result.background).toEqual({ $value: "#cc0066" });
        expect(result.text).toEqual({ $value: "#ffffff" });
    });

    it("adds new tokens from local alongside inherited", () => {
        const base = {
            background: { $value: "#0066cc" },
        };
        const local = {
            border: { $value: "1px solid" },
        };

        const result = mergeGroups(base, local);

        expect(result.background).toEqual({ $value: "#0066cc" });
        expect(result.border).toEqual({ $value: "1px solid" });
    });

    it("complete replacement: overriding replaces entire token, not property-by-property", () => {
        const base = {
            token: { $value: "#0066cc", $type: "color" as const, $description: "Base color" },
        };
        const local = {
            token: { $value: "#cc0066" },
        };

        const result = mergeGroups(base, local);

        // Local completely replaces — no $type or $description carried over
        expect(result.token).toEqual({ $value: "#cc0066" });
    });

    it("deep merges nested groups", () => {
        const base = {
            field: {
                width: { $value: "12rem" },
                background: { $value: "#ffffff" },
            },
        };
        const local = {
            field: {
                width: { $value: "100px" },
            },
        };

        const result = mergeGroups(base, local);

        const field = result.field as Record<string, unknown>;
        expect(field.width).toEqual({ $value: "100px" });
        expect(field.background).toEqual({ $value: "#ffffff" });
    });

    it("local $type overrides base $type", () => {
        const base = { $type: "color" as const };
        const local = { $type: "dimension" as const };

        const result = mergeGroups(base, local);

        expect(result.$type).toBe("dimension");
    });

    it("inherits base $type when local has none", () => {
        const base = { $type: "color" as const };
        const local = {};

        const result = mergeGroups(base, local);

        expect(result.$type).toBe("color");
    });

    it("handles $root token inheritance", () => {
        const base = {
            $root: { $value: "#0066cc" },
            light: { $value: "#3399ff" },
        };
        const local = {
            dark: { $value: "#003366" },
        };

        const result = mergeGroups(base, local);

        expect(result.$root).toEqual({ $value: "#0066cc" });
        expect(result.light).toEqual({ $value: "#3399ff" });
        expect(result.dark).toEqual({ $value: "#003366" });
    });

    it("local $root overrides base $root", () => {
        const base = { $root: { $value: "#0066cc" } };
        const local = { $root: { $value: "#cc0066" } };

        const result = mergeGroups(base, local);

        expect(result.$root).toEqual({ $value: "#cc0066" });
    });

    it("does not propagate $extends", () => {
        const base = { token: { $value: "a" } };
        const local = { $extends: "{base}" };

        const result = mergeGroups(base, local);

        expect(result.$extends).toBeUndefined();
    });
});
