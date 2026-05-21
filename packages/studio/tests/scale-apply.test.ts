/**
 * Verifies the cascade overlay layer: iterating user edits, deriving
 * captures from the live baseline, applying the base+spread transform,
 * and skipping bindings with no edits.
 */

import type { ScaleBinding } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { applyScaleEdits } from "../src/store/scale-apply";
import type {
    LinkBindingMeta,
    LinkEdit,
    ScaleBindingMeta,
    ScaleEdit,
} from "../src/store/scale-types";
import { PathIndex } from "../src/tokens/path-index";
import { resolved, snapshot } from "./fixtures";

const sizeBinding: ScaleBinding = {
    type: "scale",
    token: "size.step.*",
    base: "size.step.0",
};

const sizeMeta: ScaleBindingMeta = {
    binding: sizeBinding,
    kind: "tokens",
    parentPath: "size.step",
    sourcePath: "size.json",
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

describe("applyScaleEdits", () => {
    it("returns the input unchanged when no edits are present", () => {
        const baselineMap = buildBaseline();
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);

        const after = applyScaleEdits(
            baselineMap,
            {},
            {},
            { "size.step.*": sizeMeta },
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
        const edit: ScaleEdit = { kind: "tokens", base: 2, spread: 1 };

        const after = applyScaleEdits(
            baselineMap,
            { "size.step.*": edit },
            {},
            { "size.step.*": sizeMeta },
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

    it("skips bindings whose capture is unresolvable (e.g. missing base path)", () => {
        // Binding points at a base path that's not in the resolved map.
        const baselineMap = resolved({ path: "size.step.0", value: { value: 1, unit: "rem" } });
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);
        const orphanBinding: ScaleBinding = {
            type: "scale",
            token: "size.other.*",
            base: "size.other.0",
        };
        const orphanMeta: ScaleBindingMeta = {
            binding: orphanBinding,
            kind: "tokens",
            parentPath: "size.other",
            sourcePath: "size.json",
        };
        const edit: ScaleEdit = { kind: "tokens", base: 2, spread: 1 };

        const after = applyScaleEdits(
            baselineMap,
            { "size.other.*": edit },
            {},
            { "size.other.*": orphanMeta },
            {},
            baseline,
            pathIndex,
            "default"
        );
        expect(after).toBe(baselineMap);
    });

    it("ignores a link whose source binding doesn't exist", () => {
        const baselineMap = buildBaseline();
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);
        const linkMeta: LinkBindingMeta = {
            bindingToken: "container.*",
            sourceBinding: "missing.binding",
        };
        const linkEdit: LinkEdit = { enabled: true };

        const after = applyScaleEdits(
            baselineMap,
            {},
            { "container.*": linkEdit },
            {},
            { "container.*": linkMeta },
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

        const sourceEdit: ScaleEdit = { kind: "tokens", base: 2, spread: 1 };
        const linkMeta: LinkBindingMeta = {
            bindingToken: "container.*",
            sourceBinding: "size.step.*",
        };
        const linkEdit: LinkEdit = { enabled: true };

        const after = applyScaleEdits(
            baselineMap,
            { "size.step.*": sourceEdit },
            { "container.*": linkEdit },
            { "size.step.*": sizeMeta },
            { "container.*": linkMeta },
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

    it("preserves per-step overrides when applying a bulk transform", () => {
        // The bulk recompute should write base/spread values for every
        // step EXCEPT those the user has pinned via overrides. The pinned
        // step keeps its exact authored value.
        const baselineMap = buildBaseline();
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);
        const edit: ScaleEdit = {
            kind: "tokens",
            base: 2,
            spread: 1,
            overrides: {
                "1": {
                    min: { value: 99, unit: "rem" },
                    max: { value: 99, unit: "rem" },
                },
            },
        };

        const after = applyScaleEdits(
            baselineMap,
            { "size.step.*": edit },
            {},
            { "size.step.*": sizeMeta },
            {},
            baseline,
            pathIndex,
            "default"
        );

        // step.0 is bulk-recomputed: base = 2, multiplier = 1 → 2rem.
        expect((after["default::size.step.0"] as { $value: { value: number } }).$value.value).toBe(
            2
        );
        // step.1 is overridden — should keep the pinned 99, NOT 2.4 from bulk.
        expect((after["default::size.step.1"] as { $value: { value: number } }).$value.value).toBe(
            99
        );
        // step.2 is bulk-recomputed: 2 * 1.44 ≈ 2.88.
        expect(
            (after["default::size.step.2"] as { $value: { value: number } }).$value.value
        ).toBeCloseTo(2.88, 4);
    });

    it("applies overrides even with no base/spread edits (override-only)", () => {
        // If the only edit on a binding is an override, bulk math is a
        // no-op (factor 1) but the override still lands.
        const baselineMap = buildBaseline();
        const baseline = snapshot({ resolved: baselineMap });
        const pathIndex = new PathIndex(baselineMap);
        const edit: ScaleEdit = {
            kind: "tokens",
            overrides: {
                "1": {
                    min: { value: 5, unit: "rem" },
                    max: { value: 5, unit: "rem" },
                },
            },
        };

        const after = applyScaleEdits(
            baselineMap,
            { "size.step.*": edit },
            {},
            { "size.step.*": sizeMeta },
            {},
            baseline,
            pathIndex,
            "default"
        );

        // step.1 overridden.
        expect((after["default::size.step.1"] as { $value: { value: number } }).$value.value).toBe(
            5
        );
        // step.0 untouched by bulk (base defaults to baseline.baseMax = 1, multiplier 1 → 1rem).
        expect((after["default::size.step.0"] as { $value: { value: number } }).$value.value).toBe(
            1
        );
    });

    it("applies a configured link by default even with no explicit toggle edit", () => {
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

        const sourceEdit: ScaleEdit = { kind: "tokens", base: 2, spread: 1 };
        const linkMeta: LinkBindingMeta = {
            bindingToken: "container.*",
            sourceBinding: "size.step.*",
        };

        const after = applyScaleEdits(
            baselineMap,
            { "size.step.*": sourceEdit },
            {},
            { "size.step.*": sizeMeta },
            { "container.*": linkMeta },
            baseline,
            pathIndex,
            "default"
        );

        expect((after["default::container.sm"] as { $value: { value: number } }).$value.value).toBe(
            200
        );
    });

    it("propagates a recipe-mode source's base edit to linked tokens", () => {
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

        const recipeSourceMeta: ScaleBindingMeta = {
            ...sizeMeta,
            kind: "scale",
        };
        const recipeEdit: ScaleEdit = {
            kind: "scale",
            scale: {
                mode: "exponential",
                base: { min: { value: 2, unit: "rem" }, max: { value: 2, unit: "rem" } },
                ratio: { min: 1.2, max: 1.2 },
                steps: { negative: 0, positive: 2 },
            },
        };
        const linkMeta: LinkBindingMeta = {
            bindingToken: "container.*",
            sourceBinding: "size.step.*",
        };

        const after = applyScaleEdits(
            baselineMap,
            { "size.step.*": recipeEdit },
            {},
            { "size.step.*": recipeSourceMeta },
            { "container.*": linkMeta },
            baseline,
            pathIndex,
            "default"
        );

        expect((after["default::container.sm"] as { $value: { value: number } }).$value.value).toBe(
            200
        );
    });

    it("applies factor 1.0 (restoring baseline) when a linked binding is disabled", () => {
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

        const sourceEdit: ScaleEdit = { kind: "tokens", base: 2, spread: 1 };
        const linkMeta: LinkBindingMeta = {
            bindingToken: "container.*",
            sourceBinding: "size.step.*",
        };
        const linkEdit: LinkEdit = { enabled: false };

        const after = applyScaleEdits(
            baselineMap,
            { "size.step.*": sourceEdit },
            { "container.*": linkEdit },
            { "size.step.*": sizeMeta },
            { "container.*": linkMeta },
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
