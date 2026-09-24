import { type TokenSources, composeTrees, resolveTokens } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { renameInSources } from "../src/tokens/rename-in-sources";
import { sources } from "./text-sources";

const resolve = (s: TokenSources) => resolveTokens(composeTrees(s).trees).resolved;

describe("renaming color.brand to color.primary, across the demo", () => {
    const before = sources();
    const result = renameInSources(before, "color.brand", "color.primary");
    if (!result) throw new Error("rename returned null");

    it("touches only the files that mention it", () => {
        expect(result.touched.map((p) => p.split("/").at(-1)).sort()).toEqual([
            "border.json",
            "color.json",
            "dark.json",
            "gradient.json",
        ]);
    });

    const changedLines = (path: string) => {
        const a = (before.files[path] as string).split("\n");
        const b = (result.sources.files[path] as string).split("\n");
        return { a, b, changed: a.filter((line, i) => line !== b[i]) };
    };

    it("restructures nothing — every file keeps its line count", () => {
        for (const path of result.touched) {
            const { a, b } = changedLines(path);
            expect(a.length).toBe(b.length);
        }
    });

    it("changes twelve lines in total: one key, eleven references", () => {
        const total = result.touched.reduce((n, path) => n + changedLines(path).changed.length, 0);
        expect(total).toBe(12);

        // color.json carries the key itself plus four of the references.
        const color = result.touched.find((p) => p.endsWith("color.json")) as string;
        expect(changedLines(color).changed).toHaveLength(5);
        expect(changedLines(color).changed[0]?.trim()).toBe('"brand": {');
    });

    it("keeps the ten stops, their descriptions and their order", () => {
        const key = Object.keys(before.files).find((p) => p.endsWith("color.json")) as string;
        const was = JSON.parse(before.files[key] as string).color.brand;
        const now = JSON.parse(result.sources.files[key] as string).color.primary;

        expect(Object.keys(now)).toEqual(Object.keys(was));
        expect(now.$description).toBe(was.$description);
        expect(now["500"].$description).toBe(was["500"].$description);
    });

    it("leaves color.brand nowhere and color.primary everywhere it was", () => {
        const all = Object.values(result.sources.files).join("\n");
        expect(all).not.toContain("color.brand");
        expect(all).toContain("color.primary");
    });

    it("rewrites references nested inside gradient stop objects", () => {
        const key = Object.keys(result.sources.files).find((p) =>
            p.endsWith("gradient.json"),
        ) as string;
        const stops = JSON.parse(result.sources.files[key] as string).gradient.brand.$value;

        expect(stops.map((s: { color: string }) => s.color)).toEqual([
            "{color.primary.400}",
            "{color.primary.700}",
        ]);
    });

    it("leaves a document that still resolves, with nothing dangling", () => {
        const after = resolveTokens(composeTrees(result.sources).trees);

        expect(after.errors.resolution).toEqual([]);
        expect(after.errors.validation).toEqual([]);
    });

    it("resolves to exactly the same values, under the new names", () => {
        const was = resolve(before);
        const now = resolve(result.sources);

        const rename = (key: string) => key.replace("color.brand", "color.primary");
        expect(Object.keys(now).sort()).toEqual(Object.keys(was).map(rename).sort());

        for (const key of Object.keys(was)) {
            const a = (was[key] as { $resolvedValue?: unknown })?.$resolvedValue;
            const b = (now[rename(key)] as { $resolvedValue?: unknown })?.$resolvedValue;
            expect(JSON.stringify(b)).toBe(JSON.stringify(a));
        }
    });
});
