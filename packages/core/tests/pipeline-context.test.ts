import { describe, expect, it, vi } from "vitest";
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
