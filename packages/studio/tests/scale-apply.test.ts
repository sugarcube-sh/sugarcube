/**
 * Verifies the cascade overlay layer: iterating user-edited scale slots,
 * deriving captures from the live baseline, applying the base+spread
 * transform, and skipping slots with no edits.
 */

import type { ScaleBinding } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { applyScaleOverlays } from "../src/store/scale-apply";
import type { LinkSlot, ScaleSlot } from "../src/store/scale-types";
import { PathIndex } from "../src/tokens/path-index";
import { resolved, snapshot } from "./fixtures";

const sizeBinding: ScaleBinding = {
    type: "scale",
    token: "size.step.*",
    base: "size.step.0",
};

/** Three steps with fluid extensions, base = step.0 = 1rem, ratio ≈ 1.2. */
function buildBaseline() {
    return resolved(
        {
            path: "size.step.0",
            value: { value: 1, unit: "rem" },
            extensions: {
                "sh.sugarcube": {
                    fluid: { min: { value: 1, unit: "rem" }, max: { value: 1, unit: "rem" } },
                },
            },
        },
        {
            path: "size.step.1",
            value: { value: 1.2, unit: "rem" },
            extensions: {
                "sh.sugarcube": {
                    fluid: { min: { value: 1.2, unit: "rem" }, max: { value: 1.2, unit: "rem" } },
                },
            },
        },
        {
            path: "size.step.2",
            value: { value: 1.44, unit: "rem" },
            extensions: {
                "sh.sugarcube": {
                    fluid: { min: { value: 1.44, unit: "rem" }, max: { value: 1.44, unit: "rem" } },
                },
            },
        }
    );
}

describe("applyScaleOverlays", () => {
    it("returns the input unchanged when no slot has edits", () => {
        const baselineMap = buildBaseline();
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);
        const slot: ScaleSlot = { binding: sizeBinding, edits: null };

        const after = applyScaleOverlays(
            baselineMap,
            { "size.step.*": slot },
            {},
            baseline,
            pathIndex,
            "default"
        );
        expect(after).toBe(baselineMap);
    });

    it("applies a base override and rescales every step proportionally", () => {
        const baselineMap = buildBaseline();
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);
        const slot: ScaleSlot = {
            binding: sizeBinding,
            edits: { base: 2, spread: 1 },
        };

        const after = applyScaleOverlays(
            baselineMap,
            { "size.step.*": slot },
            {},
            baseline,
            pathIndex,
            "default"
        );

        // step.0 was the base (1rem); doubling base → step.0 = 2rem.
        expect((after["default::size.step.0"] as { $value: { value: number } }).$value.value).toBe(
            2
        );
        // step.1 multiplier was 1.2 → 1.2 * 2 = 2.4rem.
        expect(
            (after["default::size.step.1"] as { $value: { value: number } }).$value.value
        ).toBeCloseTo(2.4, 4);
    });

    it("skips slots whose binding has no resolvable capture (e.g. missing base path)", () => {
        // Binding points at a base path that's not in the resolved map.
        const baselineMap = resolved({ path: "size.step.0", value: { value: 1, unit: "rem" } });
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);
        const orphanBinding: ScaleBinding = {
            type: "scale",
            token: "size.other.*",
            base: "size.other.0",
        };
        const slot: ScaleSlot = {
            binding: orphanBinding,
            edits: { base: 2, spread: 1 },
        };

        const after = applyScaleOverlays(
            baselineMap,
            { "size.other.*": slot },
            {},
            baseline,
            pathIndex,
            "default"
        );
        expect(after).toBe(baselineMap);
    });

    it("ignores a link slot whose source binding doesn't exist", () => {
        const baselineMap = buildBaseline();
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);
        const link: LinkSlot = {
            bindingToken: "container.*",
            sourceBinding: "missing.binding",
            edits: { enabled: true },
        };

        const after = applyScaleOverlays(
            baselineMap,
            {},
            { c: link },
            baseline,
            pathIndex,
            "default"
        );
        expect(after).toBe(baselineMap);
    });

    it("applies the source's base/baseMax factor to enabled linked tokens", () => {
        // Source scale (size.step.0 = 1rem) + linked container tokens.
        // Source base doubled → factor = 2; container values should double.
        const baselineMap = resolved(
            {
                path: "size.step.0",
                value: { value: 1, unit: "rem" },
                extensions: {
                    "sh.sugarcube": {
                        fluid: {
                            min: { value: 1, unit: "rem" },
                            max: { value: 1, unit: "rem" },
                        },
                    },
                },
            },
            { path: "container.sm", value: { value: 100, unit: "px" } },
            { path: "container.md", value: { value: 200, unit: "px" } }
        );
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);

        const sourceSlot: ScaleSlot = {
            binding: sizeBinding,
            edits: { base: 2, spread: 1 },
        };
        const link: LinkSlot = {
            bindingToken: "container.*",
            sourceBinding: "size.step.*",
            edits: { enabled: true },
        };

        const after = applyScaleOverlays(
            baselineMap,
            { "size.step.*": sourceSlot },
            { "container.*": link },
            baseline,
            pathIndex,
            "default"
        );

        expect((after["default::container.sm"] as { $value: { value: number } }).$value.value).toBe(
            200
        );
        expect((after["default::container.md"] as { $value: { value: number } }).$value.value).toBe(
            400
        );
    });

    it("applies factor 1.0 (restoring baseline) when a linked slot is disabled", () => {
        const baselineMap = resolved(
            {
                path: "size.step.0",
                value: { value: 1, unit: "rem" },
                extensions: {
                    "sh.sugarcube": {
                        fluid: {
                            min: { value: 1, unit: "rem" },
                            max: { value: 1, unit: "rem" },
                        },
                    },
                },
            },
            { path: "container.sm", value: { value: 100, unit: "px" } }
        );
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);

        const sourceSlot: ScaleSlot = {
            binding: sizeBinding,
            edits: { base: 2, spread: 1 },
        };
        const link: LinkSlot = {
            bindingToken: "container.*",
            sourceBinding: "size.step.*",
            edits: { enabled: false },
        };

        const after = applyScaleOverlays(
            baselineMap,
            { "size.step.*": sourceSlot },
            { "container.*": link },
            baseline,
            pathIndex,
            "default"
        );

        // Disabled link → factor 1.0 → container value reverts to baseline.
        expect((after["default::container.sm"] as { $value: { value: number } }).$value.value).toBe(
            100
        );
    });
});
