import { describe, expect, it } from "vitest";
import { PathIndex } from "../src/tokens/path-index";
import { resolved } from "./fixtures";

describe("PathIndex", () => {
    it("groups tokens by $path across permutation contexts", () => {
        const index = new PathIndex(
            resolved(
                { path: "color.bg", value: "#fff", context: "light" },
                { path: "color.bg", value: "#000", context: "dark" },
                { path: "color.fg", value: "#000", context: "light" },
            ),
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
                { path: "color.bg", value: "#000", context: "dark" },
            ),
        );
        const map = resolved(
            { path: "color.bg", value: "#fff", context: "light" },
            { path: "color.bg", value: "#000", context: "dark" },
        );

        it("returns the value for the requested context", () => {
            expect(index.readValue(map, "color.bg", "dark")).toBe("#000");
        });

        it("returns undefined for an unknown path", () => {
            expect(index.readValue(map, "missing.path")).toBeUndefined();
        });
    });

    describe("matching", () => {
        const index = new PathIndex(
            resolved(
                { path: "size.step.0", value: 16 },
                { path: "size.step.1", value: 18 },
                { path: "size.step.2", value: 20 },
                { path: "color.bg", value: "#fff" },
            ),
        );

        it("matches a single segment with *", () => {
            expect([...index.matching("size.step.*")].sort()).toEqual([
                "size.step.0",
                "size.step.1",
                "size.step.2",
            ]);
        });

        it("requires exact segment count", () => {
            // `size.*` would NOT match `size.step.0` - that's a deeper path.
            expect(index.matching("size.*")).toEqual([]);
        });
    });
});
