import { describe, expect, it } from "vitest";
import { PathIndex } from "../src/tokens/path-index";
import { resolved } from "./fixtures";

describe("PathIndex", () => {
    it("groups tokens by $path across permutation contexts", () => {
        const index = new PathIndex(
            resolved(
                { path: "color.bg", value: "#fff", context: "light" },
                { path: "color.bg", value: "#000", context: "dark" },
                { path: "color.fg", value: "#000", context: "light" }
            )
        );

        const bg = index.entriesFor("color.bg");
        expect(bg.map((e) => e.context).sort()).toEqual(["dark", "light"]);
        expect(index.entriesFor("color.fg")).toHaveLength(1);
    });

    it("falls back to context 'default' when source.context is unset", () => {
        const index = new PathIndex(resolved({ path: "size.step.0", value: 16 }));
        expect(index.entriesFor("size.step.0")[0]?.context).toBe("default");
    });

    it("returns an empty array for unknown paths", () => {
        const index = new PathIndex(resolved({ path: "color.bg", value: "#fff" }));
        expect(index.entriesFor("does.not.exist")).toEqual([]);
    });

    describe("readValue", () => {
        const index = new PathIndex(
            resolved(
                { path: "color.bg", value: "#fff", context: "light" },
                { path: "color.bg", value: "#000", context: "dark" }
            )
        );
        const map = resolved(
            { path: "color.bg", value: "#fff", context: "light" },
            { path: "color.bg", value: "#000", context: "dark" }
        );

        it("returns the value for the requested context", () => {
            expect(index.readValue(map, "color.bg", "dark")).toBe("#000");
        });

        it("returns undefined for an unknown path", () => {
            expect(index.readValue(map, "missing.path")).toBeUndefined();
        });
    });

    describe("setValue", () => {
        it("updates a single context immutably", () => {
            const index = new PathIndex(
                resolved(
                    { path: "color.bg", value: "#fff", context: "light" },
                    { path: "color.bg", value: "#000", context: "dark" }
                )
            );
            const before = resolved(
                { path: "color.bg", value: "#fff", context: "light" },
                { path: "color.bg", value: "#000", context: "dark" }
            );

            const after = index.setValue(before, "color.bg", "#eee", "light");

            expect(after).not.toBe(before);
            expect((after["light::color.bg"] as { $value: unknown }).$value).toBe("#eee");
            expect((after["dark::color.bg"] as { $value: unknown }).$value).toBe("#000");
        });

        it("updates every context when no context is given", () => {
            const index = new PathIndex(
                resolved(
                    { path: "color.bg", value: "#fff", context: "light" },
                    { path: "color.bg", value: "#000", context: "dark" }
                )
            );
            const before = resolved(
                { path: "color.bg", value: "#fff", context: "light" },
                { path: "color.bg", value: "#000", context: "dark" }
            );

            const after = index.setValue(before, "color.bg", "#eee");

            expect((after["light::color.bg"] as { $value: unknown }).$value).toBe("#eee");
            expect((after["dark::color.bg"] as { $value: unknown }).$value).toBe("#eee");
        });

        it("returns the input unchanged for an unknown path", () => {
            const index = new PathIndex(resolved({ path: "color.bg", value: "#fff" }));
            const before = resolved({ path: "color.bg", value: "#fff" });
            expect(index.setValue(before, "missing", "x")).toBe(before);
        });
    });

    describe("matching", () => {
        const index = new PathIndex(
            resolved(
                { path: "size.step.0", value: 16 },
                { path: "size.step.1", value: 18 },
                { path: "size.step.2", value: 20 },
                { path: "color.bg", value: "#fff" }
            )
        );

        it("matches a single segment with *", () => {
            expect(index.matching("size.step.*").sort()).toEqual([
                "size.step.0",
                "size.step.1",
                "size.step.2",
            ]);
        });

        it("requires exact segment count", () => {
            // `size.*` would NOT match `size.step.0` — that's a deeper path.
            expect(index.matching("size.*")).toEqual([]);
        });
    });

    describe("refresh", () => {
        it("rebuilds the index against a new resolved map (in place)", () => {
            const index = new PathIndex(resolved({ path: "size.step.0", value: 16 }));

            // Before: only step.0 exists.
            expect(index.entriesFor("size.step.6")).toEqual([]);

            // External edit adds step.6.
            index.refresh(
                resolved({ path: "size.step.0", value: 16 }, { path: "size.step.6", value: 32 })
            );

            expect(index.entriesFor("size.step.6")).toHaveLength(1);
            expect(index.entriesFor("size.step.6")[0]?.context).toBe("default");
        });

        it("forgets paths that no longer exist after refresh", () => {
            const index = new PathIndex(
                resolved({ path: "size.step.0", value: 16 }, { path: "size.step.1", value: 18 })
            );
            expect(index.entriesFor("size.step.1")).toHaveLength(1);

            index.refresh(resolved({ path: "size.step.0", value: 16 }));

            expect(index.entriesFor("size.step.1")).toEqual([]);
        });
    });

    describe("resolvedKeys", () => {
        it("returns every internal lookup key the index covers", () => {
            const index = new PathIndex(
                resolved(
                    { path: "color.bg", value: "#fff", context: "light" },
                    { path: "color.bg", value: "#000", context: "dark" }
                )
            );
            const keys = [...index.resolvedKeys()].sort();
            expect(keys).toEqual(["dark::color.bg", "light::color.bg"]);
        });
    });
});
