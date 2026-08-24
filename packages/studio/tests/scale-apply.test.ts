import type { ScaleBinding, ScaleExtension } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { applyScaleEdits } from "../src/store/scale-apply";
import type {
    LinkBindingMeta,
    LinkEdit,
    ScaleBindingMeta,
    ScaleEdit,
} from "../src/store/scale-types";
import { PathIndex } from "../src/tokens/path-index";
import { resolved, snapshot, tree } from "./fixtures";

function sizeStepTrees() {
    return [
        tree("size.json", {
            size: {
                step: {
                    $extensions: {
                        "sh.sugarcube": {
                            scale: {
                                mode: "exponential",
                                base: {
                                    min: { value: 1, unit: "rem" },
                                    max: { value: 1, unit: "rem" },
                                },
                                ratio: { min: 1.2, max: 1.2 },
                                steps: { negative: 0, positive: 2 },
                            },
                        },
                    },
                },
            },
        }),
    ];
}

const sizeScaleMeta: ScaleBindingMeta = {
    binding: { type: "scale", token: "size.step.*", base: "size.step.0" },
    kind: "scale",
    parentPath: "size.step",
    ownedPaths: ["size.step.0", "size.step.1", "size.step.2"],
    sourcePath: "size.json",
};

const sizeBinding: ScaleBinding = {
    type: "scale",
    token: "size.step.*",
    base: "size.step.0",
};

const sizeMeta: ScaleBindingMeta = {
    binding: sizeBinding,
    kind: "tokens",
    parentPath: "size.step",
    ownedPaths: ["size.step.0", "size.step.1", "size.step.2"],
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
        },
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
            "default",
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
            "default",
        );

        expect((after["default::size.step.0"] as { $value: { value: number } }).$value.value).toBe(
            2,
        );
        expect(
            (after["default::size.step.1"] as { $value: { value: number } }).$value.value,
        ).toBeCloseTo(2.4, 4);
    });

    it("skips bindings whose capture is unresolvable (e.g. missing base path)", () => {
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
            ownedPaths: [],
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
            "default",
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
            "default",
        );
        expect(after).toBe(baselineMap);
    });

    it("scales linked tokens by the source scale's base change", () => {
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
            { path: "container.md", value: { value: 200, unit: "px" } },
        );
        const baseline = snapshot({ resolved: baselineMap, trees: sizeStepTrees() });
        const pathIndex = new PathIndex(baselineMap);

        const sourceEdit: ScaleEdit = {
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
        const linkEdit: LinkEdit = { enabled: true };

        const after = applyScaleEdits(
            baselineMap,
            { "size.step.*": sourceEdit },
            { "container.*": linkEdit },
            { "size.step.*": sizeScaleMeta },
            { "container.*": linkMeta },
            baseline,
            pathIndex,
            "default",
        );

        expect((after["default::container.sm"] as { $value: { value: number } }).$value.value).toBe(
            200,
        );
        expect((after["default::container.md"] as { $value: { value: number } }).$value.value).toBe(
            400,
        );
    });

    it("leaves linked tokens unchanged when only the source ratio changes", () => {
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
        );
        const baseline = snapshot({ resolved: baselineMap, trees: sizeStepTrees() });
        const pathIndex = new PathIndex(baselineMap);

        const sourceEdit: ScaleEdit = {
            kind: "scale",
            scale: {
                mode: "exponential",
                base: { min: { value: 1, unit: "rem" }, max: { value: 1, unit: "rem" } },
                ratio: { min: 2.4, max: 2.4 },
                steps: { negative: 0, positive: 2 },
            },
        };
        const linkMeta: LinkBindingMeta = {
            bindingToken: "container.*",
            sourceBinding: "size.step.*",
        };

        const after = applyScaleEdits(
            baselineMap,
            { "size.step.*": sourceEdit },
            {},
            { "size.step.*": sizeScaleMeta },
            { "container.*": linkMeta },
            baseline,
            pathIndex,
            "default",
        );

        expect((after["default::container.sm"] as { $value: { value: number } }).$value.value).toBe(
            100,
        );
    });

    it("scales linked tokens from a direct-mode base edit", () => {
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
        );
        const baseline = snapshot({ resolved: baselineMap, trees: sizeStepTrees() });
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
            "default",
        );

        expect((after["default::container.sm"] as { $value: { value: number } }).$value.value).toBe(
            200,
        );
    });

    it("scales linked tokens from a multipliers recipe too", () => {
        const baselineMap = resolved(
            { path: "space.sm", value: { value: 1, unit: "rem" } },
            { path: "container.sm", value: { value: 100, unit: "px" } },
        );
        const baseline = snapshot({
            resolved: baselineMap,
            trees: [
                tree("space.json", {
                    space: {
                        $extensions: {
                            "sh.sugarcube": {
                                scale: {
                                    mode: "multipliers",
                                    base: {
                                        min: { value: 1, unit: "rem" },
                                        max: { value: 1, unit: "rem" },
                                    },
                                    multipliers: { sm: 1 },
                                },
                            },
                        },
                    },
                }),
            ],
        });
        const pathIndex = new PathIndex(baselineMap);

        const spaceMeta: ScaleBindingMeta = {
            binding: { type: "scale", token: "space.*", base: "space.sm" },
            kind: "scale",
            parentPath: "space",
            ownedPaths: ["space.sm"],
            sourcePath: "space.json",
        };
        const sourceEdit: ScaleEdit = {
            kind: "scale",
            scale: {
                mode: "multipliers",
                base: { min: { value: 2, unit: "rem" }, max: { value: 2, unit: "rem" } },
                multipliers: { sm: 1 },
            } as ScaleExtension,
        };

        const after = applyScaleEdits(
            baselineMap,
            { "space.*": sourceEdit },
            {},
            { "space.*": spaceMeta },
            { "container.*": { bindingToken: "container.*", sourceBinding: "space.*" } },
            baseline,
            pathIndex,
            "default",
        );

        expect((after["default::container.sm"] as { $value: { value: number } }).$value.value).toBe(
            200,
        );
    });

    it("scales linked tokens when the source recipe binding has no `base`", () => {
        const baselineMap = resolved(
            { path: "size.step.0", value: { value: 1, unit: "rem" } },
            { path: "container.sm", value: { value: 100, unit: "px" } },
        );
        const baseline = snapshot({ resolved: baselineMap, trees: sizeStepTrees() });
        const pathIndex = new PathIndex(baselineMap);

        const noBaseMeta: ScaleBindingMeta = {
            binding: { type: "scale", token: "size.step.*" },
            kind: "scale",
            parentPath: "size.step",
            ownedPaths: ["size.step.0"],
            sourcePath: "size.json",
        };
        const sourceEdit: ScaleEdit = {
            kind: "scale",
            scale: {
                mode: "exponential",
                base: { min: { value: 2, unit: "rem" }, max: { value: 2, unit: "rem" } },
                ratio: { min: 1.2, max: 1.2 },
                steps: { negative: 0, positive: 2 },
            },
        };

        const after = applyScaleEdits(
            baselineMap,
            { "size.step.*": sourceEdit },
            {},
            { "size.step.*": noBaseMeta },
            { "container.*": { bindingToken: "container.*", sourceBinding: "size.step.*" } },
            baseline,
            pathIndex,
            "default",
        );

        expect((after["default::container.sm"] as { $value: { value: number } }).$value.value).toBe(
            200,
        );
    });

    it("preserves per-step overrides when applying a bulk transform", () => {
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
            "default",
        );

        expect((after["default::size.step.0"] as { $value: { value: number } }).$value.value).toBe(
            2,
        );
        expect((after["default::size.step.1"] as { $value: { value: number } }).$value.value).toBe(
            99,
        );
        expect(
            (after["default::size.step.2"] as { $value: { value: number } }).$value.value,
        ).toBeCloseTo(2.88, 4);
    });

    it("applies overrides even with no base/spread edits (override-only)", () => {
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
            "default",
        );

        expect((after["default::size.step.1"] as { $value: { value: number } }).$value.value).toBe(
            5,
        );
        expect((after["default::size.step.0"] as { $value: { value: number } }).$value.value).toBe(
            1,
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
            { path: "container.sm", value: { value: 100, unit: "px" } },
        );
        const baseline = snapshot({ resolved: baselineMap, trees: sizeStepTrees() });
        const pathIndex = new PathIndex(baselineMap);

        const sourceEdit: ScaleEdit = {
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
            { "size.step.*": sourceEdit },
            {},
            { "size.step.*": sizeScaleMeta },
            { "container.*": linkMeta },
            baseline,
            pathIndex,
            "default",
        );

        expect((after["default::container.sm"] as { $value: { value: number } }).$value.value).toBe(
            200,
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
            { path: "container.sm", value: { value: 100, unit: "px" } },
        );
        const baseline = snapshot({ resolved: baselineMap, trees: sizeStepTrees() });
        const pathIndex = new PathIndex(baselineMap);

        const sourceEdit: ScaleEdit = {
            kind: "scale",
            scale: {
                mode: "exponential",
                base: { min: { value: 1, unit: "rem" }, max: { value: 1, unit: "rem" } },
                ratio: { min: 2.4, max: 2.4 },
                steps: { negative: 0, positive: 2 },
            },
        };
        const linkMeta: LinkBindingMeta = {
            bindingToken: "container.*",
            sourceBinding: "size.step.*",
        };
        const linkEdit: LinkEdit = { enabled: false };

        const after = applyScaleEdits(
            baselineMap,
            { "size.step.*": sourceEdit },
            { "container.*": linkEdit },
            { "size.step.*": sizeScaleMeta },
            { "container.*": linkMeta },
            baseline,
            pathIndex,
            "default",
        );

        expect((after["default::container.sm"] as { $value: { value: number } }).$value.value).toBe(
            100,
        );
    });
});
