import { validateConfig } from "@sugarcube-sh/core";
import { describe, expect, it } from "vitest";

describe("Config Schema Validation", () => {
    it("validates a config with resolver path", () => {
        const config = {
            resolver: "tokens.resolver.json",
        };

        const result = validateConfig(config);
        expect(result).toBeDefined();
        expect(result.resolver).toBe("tokens.resolver.json");
    });

    it("validates a config with resolver and output", () => {
        const config = {
            resolver: "src/tokens/tokens.resolver.json",
            output: {
                cssRoot: "src/styles",
            },
        };

        const result = validateConfig(config);
        expect(result).toBeDefined();
        expect(result.resolver).toBe("src/tokens/tokens.resolver.json");
        expect(result.output.cssRoot).toBe("src/styles");
    });

    it("validates a config with transforms", () => {
        const config = {
            resolver: "tokens.resolver.json",
            transforms: {
                fluid: { min: 320, max: 1200 },
                colorFallbackStrategy: "native" as const,
            },
        };

        const result = validateConfig(config);
        expect(result).toBeDefined();
        expect(result.transforms.fluid).toEqual({ min: 320, max: 1200 });
    });

    it("validates an empty config (resolver is optional)", () => {
        const config = {};

        const result = validateConfig(config);
        expect(result).toBeDefined();
        // Should have defaults filled in
        expect(result.output).toBeDefined();
        expect(result.transforms).toBeDefined();
    });

    it("rejects a config with invalid output structure", () => {
        const config = {
            resolver: "tokens.resolver.json",
            output: {
                cssRoot: 123 as any, // Should be string
            },
        };

        expect(() => validateConfig(config)).toThrow();
    });

    it("rejects a config with invalid transforms", () => {
        const config = {
            resolver: "tokens.resolver.json",
            transforms: {
                fluid: { min: "invalid" as any, max: 1200 }, // min should be number
            },
        };

        expect(() => validateConfig(config)).toThrow();
    });

    it("rejects a config with invalid color fallback strategy", () => {
        const config = {
            resolver: "tokens.resolver.json",
            transforms: {
                colorFallbackStrategy: "invalid" as any,
            },
        };

        expect(() => validateConfig(config)).toThrow();
    });
});
