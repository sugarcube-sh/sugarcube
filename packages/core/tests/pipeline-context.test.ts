import { describe, expect, it, vi } from "vitest";
import { validate } from "../src/pipeline/validate";
import type { FlattenedTokens } from "../src/types/flatten";
import { createPipelineContext } from "../src/types/pipelines";

describe("PipelineContext", () => {
    it("should accumulate warnings via warn()", () => {
        const ctx = createPipelineContext();

        ctx.warn({ path: "a.b", message: "first warning" });
        ctx.warn({ path: "c.d", message: "second warning" });

        expect(ctx.warnings).toHaveLength(2);
        expect(ctx.warnings[0]).toEqual({ path: "a.b", message: "first warning" });
        expect(ctx.warnings[1]).toEqual({ path: "c.d", message: "second warning" });
    });

    it("should emit warning events when warn() is called", () => {
        const emit = vi.fn();
        const ctx = createPipelineContext({ emit });

        ctx.warn({ path: "a.b", message: "test warning" });

        expect(emit).toHaveBeenCalledOnce();
        expect(emit).toHaveBeenCalledWith({
            type: "warning",
            warning: { path: "a.b", message: "test warning" },
        });
    });

    it("should deduplicate warnings with the same path and message", () => {
        const emit = vi.fn();
        const ctx = createPipelineContext({ emit });

        ctx.warn({ path: "a.b", message: "duplicate warning" });
        ctx.warn({ path: "a.b", message: "duplicate warning" });
        ctx.warn({ path: "a.b", message: "different message" });

        expect(ctx.warnings).toHaveLength(2);
        expect(emit).toHaveBeenCalledTimes(2);
    });

    it("should not throw when emit is not provided", () => {
        const ctx = createPipelineContext();
        expect(() => ctx.warn({ path: "a.b", message: "test" })).not.toThrow();
    });

    it("should forward arbitrary events via emit()", () => {
        const emit = vi.fn();
        const ctx = createPipelineContext({ emit });

        ctx.emit({ type: "stage:start", stage: "validate" });
        ctx.emit({ type: "stage:end", stage: "validate", durationMs: 5 });

        expect(emit).toHaveBeenCalledTimes(2);
        expect(emit).toHaveBeenCalledWith({ type: "stage:start", stage: "validate" });
        expect(emit).toHaveBeenCalledWith({ type: "stage:end", stage: "validate", durationMs: 5 });
    });
});

describe("validate with PipelineContext", () => {
    it("should emit a deprecation warning for fluidDimension tokens", () => {
        const ctx = createPipelineContext();
        const tokens: FlattenedTokens = {
            tokens: {
                "default.spacing.fluid": {
                    $type: "fluidDimension",
                    $value: {
                        min: { value: 16, unit: "px" },
                        max: { value: 32, unit: "px" },
                    },
                    $path: "spacing.fluid",
                    $source: { sourcePath: "tokens.json" },
                    $originalPath: "spacing.fluid",
                },
            },
            pathIndex: new Map([["spacing.fluid", "default.spacing.fluid"]]),
        };

        const errors = validate(tokens, ctx);

        expect(errors).toHaveLength(0);
        expect(ctx.warnings).toHaveLength(1);
        expect(ctx.warnings[0]?.message).toContain("fluidDimension");
        expect(ctx.warnings[0]?.message).toContain("deprecated");
        expect(ctx.warnings[0]?.path).toBe("spacing.fluid");
    });

    it("should not emit warnings for non-deprecated token types", () => {
        const ctx = createPipelineContext();
        const tokens: FlattenedTokens = {
            tokens: {
                "default.color.primary": {
                    $type: "color",
                    $value: "#0066cc",
                    $path: "color.primary",
                    $source: { sourcePath: "tokens.json" },
                    $originalPath: "color.primary",
                },
            },
            pathIndex: new Map([["color.primary", "default.color.primary"]]),
        };

        const errors = validate(tokens, ctx);

        expect(errors).toHaveLength(0);
        expect(ctx.warnings).toHaveLength(0);
    });

    it("should still return validation errors normally when context is provided", () => {
        const ctx = createPipelineContext();
        const tokens: FlattenedTokens = {
            tokens: {
                "default.color.bad": {
                    $type: "color",
                    $value: "not-a-color",
                    $path: "color.bad",
                    $source: { sourcePath: "tokens.json" },
                    $originalPath: "color.bad",
                },
            },
            pathIndex: new Map([["color.bad", "default.color.bad"]]),
        };

        const errors = validate(tokens, ctx);

        expect(errors.length).toBeGreaterThan(0);
    });
});
