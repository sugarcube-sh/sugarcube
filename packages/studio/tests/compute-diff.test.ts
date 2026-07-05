import type { ScaleExtension } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import type { ScaleBindingMeta, ScaleEdit } from "../src/store/scale-types";
import { computeDiff } from "../src/tokens/compute-diff";
import { PathIndex } from "../src/tokens/path-index";
import { resolved, snapshot, tree } from "./fixtures";

const sizeBindingMeta: ScaleBindingMeta = {
    binding: { type: "scale", token: "size.step.*", base: "size.step.0" },
    kind: "scale",
    parentPath: "size.step",
    sourcePath: "size.json",
};

const makeScale = (override: Partial<ScaleExtension> = {}): ScaleExtension =>
    ({
        mode: "exponential",
        viewport: { min: 320, max: 1440 },
        base: { min: { value: 1, unit: "rem" }, max: { value: 1, unit: "rem" } },
        ratio: { min: 1.2, max: 1.2 },
        steps: { negative: 0, positive: 2 },
        ...override,
    }) as ScaleExtension;

describe("computeDiff", () => {
    it("returns no entries when nothing changed", () => {
        const baselineMap = resolved({ path: "color.bg", value: "#fff" });
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);

        expect(computeDiff(baselineMap, baseline, pathIndex)).toEqual([]);
    });

    it("emits a single leaf entry for a per-token change with the exact expected shape", () => {
        const baselineMap = resolved({ path: "color.bg", value: "#fff" });
        const current = resolved({ path: "color.bg", value: "#eee" });
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);

        const diff = computeDiff(current, baseline, pathIndex);
        // toEqual (not toMatchObject) — guards against stray fields slipping
        // into the diff entry and ending up in the file write.
        expect(diff).toEqual([
            {
                path: "color.bg",
                sourcePath: "tokens.json",
                contexts: [],
                from: { $value: "#fff" },
                to: { $value: "#eee" },
            },
        ]);
    });

    it("collapses identical changes across all permutations into contexts: []", () => {
        const baselineMap = resolved(
            { path: "color.bg", value: "#fff", context: "light" },
            { path: "color.bg", value: "#fff", context: "dark" },
        );
        const current = resolved(
            { path: "color.bg", value: "#eee", context: "light" },
            { path: "color.bg", value: "#eee", context: "dark" },
        );
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);

        const diff = computeDiff(current, baseline, pathIndex);
        expect(diff).toHaveLength(1);
        expect(diff[0]?.contexts).toEqual([]);
    });

    it("skips paths the index knows about but the baseline doesn't", () => {
        // Stale-pathIndex scenario: the index was built before a token was
        // removed externally. computeDiff must not crash or emit noise for
        // a path whose baseline entry is gone — it just skips it.
        const baselineMap = resolved({ path: "color.bg", value: "#fff" });
        // PathIndex was built from a richer map that included color.fg.
        const indexedFromOlderMap = resolved(
            { path: "color.bg", value: "#fff" },
            { path: "color.fg", value: "#000" },
        );
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(indexedFromOlderMap);

        // Current also lacks color.fg.
        expect(computeDiff(baselineMap, baseline, pathIndex)).toEqual([]);
    });

    it("keeps contexts populated when only some permutations changed", () => {
        const baselineMap = resolved(
            { path: "color.bg", value: "#fff", context: "light" },
            { path: "color.bg", value: "#000", context: "dark" },
        );
        const current = resolved(
            { path: "color.bg", value: "#eee", context: "light" },
            { path: "color.bg", value: "#000", context: "dark" },
        );
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);

        const diff = computeDiff(current, baseline, pathIndex);
        expect(diff).toHaveLength(1);
        expect(diff[0]?.contexts).toEqual(["light"]);
    });

    describe("scale-extension-owned paths", () => {
        const userEdit = makeScale({ ratio: { min: 1.5, max: 1.5 } });
        const edits: Record<string, ScaleEdit> = {
            "size.step.*": { kind: "scale", scale: userEdit },
        };
        const bindings: Record<string, ScaleBindingMeta> = {
            "size.step.*": sizeBindingMeta,
        };

        it("emits a group-level scale diff when the edit differs from on-disk", () => {
            const onDisk = makeScale();
            const baselineMap = resolved(
                { path: "size.step.0", value: { value: 1, unit: "rem" } },
                { path: "size.step.1", value: { value: 1.2, unit: "rem" } },
            );
            const baseline = snapshot({
                resolved: baselineMap,
                trees: [
                    tree("size.json", {
                        size: { step: { $extensions: { "sh.sugarcube": { scale: onDisk } } } },
                    }),
                ],
            });
            const pathIndex = new PathIndex(baselineMap);

            const diff = computeDiff(baselineMap, baseline, pathIndex, edits, bindings);
            expect(diff).toHaveLength(1);
            expect(diff[0]).toMatchObject({
                path: "size.step",
                sourcePath: "size.json",
                from: { $extensions: { "sh.sugarcube": { scale: onDisk } } },
                to: { $extensions: { "sh.sugarcube": { scale: userEdit } } },
            });
        });

        it("suppresses leaf diffs that descend from a scale-extension binding", () => {
            // The leaves changed too (because the scale was materialized),
            // but the user committed via the extension — the diff should
            // write the extension back, not the 13 generated leaves.
            const onDisk = makeScale();
            const baselineMap = resolved(
                { path: "size.step.0", value: { value: 1, unit: "rem" } },
                { path: "size.step.1", value: { value: 1.2, unit: "rem" } },
            );
            const overlaidLeaves = resolved(
                { path: "size.step.0", value: { value: 1, unit: "rem" } },
                { path: "size.step.1", value: { value: 1.5, unit: "rem" } },
            );
            const baseline = snapshot({
                resolved: baselineMap,
                trees: [
                    tree("size.json", {
                        size: { step: { $extensions: { "sh.sugarcube": { scale: onDisk } } } },
                    }),
                ],
            });
            const pathIndex = new PathIndex(baselineMap);

            const diff = computeDiff(overlaidLeaves, baseline, pathIndex, edits, bindings);
            // Exactly one entry — the scale diff. No leaf entry for size.step.1.
            expect(diff).toHaveLength(1);
            expect(diff[0]?.path).toBe("size.step");
        });

        it("emits no entry when there's no edit for a scale binding (no user edit)", () => {
            const onDisk = makeScale();
            const baselineMap = resolved({ path: "size.step.0", value: { value: 1, unit: "rem" } });
            const baseline = snapshot({
                resolved: baselineMap,
                trees: [
                    tree("size.json", {
                        size: { step: { $extensions: { "sh.sugarcube": { scale: onDisk } } } },
                    }),
                ],
            });
            const pathIndex = new PathIndex(baselineMap);

            // No edit entry for the binding. Bindings still registered.
            expect(computeDiff(baselineMap, baseline, pathIndex, {}, bindings)).toEqual([]);
        });

        it("emits no entry when the edit deeply equals the on-disk scale", () => {
            // After-save scenario: edits were not yet cleared but match disk.
            const r = makeScale();
            const baselineMap = resolved({ path: "size.step.0", value: { value: 1, unit: "rem" } });
            const baseline = snapshot({
                resolved: baselineMap,
                trees: [
                    tree("size.json", {
                        size: { step: { $extensions: { "sh.sugarcube": { scale: r } } } },
                    }),
                ],
            });
            const pathIndex = new PathIndex(baselineMap);

            const editsEqualDisk: Record<string, ScaleEdit> = {
                "size.step.*": { kind: "scale", scale: r },
            };

            expect(computeDiff(baselineMap, baseline, pathIndex, editsEqualDisk, bindings)).toEqual(
                [],
            );
        });
    });
});
