import { SUGARCUBE_NAMESPACE, type TokenTree } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { PathIndex } from "../src/tokens/path-index";
import { directScaleGroups, getScaleBase } from "../src/tokens/scale-extension";
import { openDocument, rename } from "../src/tokens/source-document";
import { resolved } from "./fixtures";
import { inMemory } from "./text-sources";

function tree(tokens: unknown): TokenTree {
    return { tokens, sourcePath: "tokens.json" } as unknown as TokenTree;
}

describe("getScaleBase", () => {
    it("reads the chosen step off the group", () => {
        const trees = [
            tree({
                space: {
                    $extensions: { [SUGARCUBE_NAMESPACE]: { scaleBase: "space.md" } },
                    md: { $value: { value: 1, unit: "rem" } },
                },
            }),
        ];

        expect(getScaleBase(trees, "space")).toBe("space.md");
    });

    it("is undefined where nothing has been chosen", () => {
        const trees = [tree({ space: { md: { $value: { value: 1, unit: "rem" } } } })];

        expect(getScaleBase(trees, "space")).toBeUndefined();
    });
});

describe("directScaleGroups", () => {
    it("counts a renamed group under its new name", () => {
        const doc = openDocument(
            inMemory({
                "t.json": `{ "space": { "$type": "dimension",
                    "sm": { "$value": { "value": 1, "unit": "rem" } },
                    "md": { "$value": { "value": 2, "unit": "rem" } } } }`,
            }),
        );
        const renamed = rename(doc, "space", "gap");
        if (!renamed) throw new Error("rename returned null");

        expect(directScaleGroups(renamed.index, renamed.resolved)).toEqual(["gap"]);
    });

    function groups(...fixtures: Parameters<typeof resolved>) {
        const map = resolved(...fixtures);
        return directScaleGroups(new PathIndex(map), map).sort();
    }

    it("finds a group of hand-authored dimensions", () => {
        expect(
            groups(
                { path: "space.xs", value: { value: 0.25, unit: "rem" } },
                { path: "space.sm", value: { value: 0.5, unit: "rem" } },
                { path: "space.md", value: { value: 1, unit: "rem" } },
            ),
        ).toEqual(["space"]);
    });

    it("ignores a group with only one dimension in it", () => {
        expect(groups({ path: "panel.radius", value: { value: 1, unit: "rem" } })).toEqual([]);
    });

    it("ignores colours", () => {
        expect(
            groups(
                { path: "color.brand.50", value: "#fff", type: "color" },
                { path: "color.brand.900", value: "#000", type: "color" },
            ),
        ).toEqual([]);
    });

    it("finds each level of a nested document separately", () => {
        expect(
            groups(
                { path: "border.width.thin", value: { value: 1, unit: "px" } },
                { path: "border.width.thick", value: { value: 2, unit: "px" } },
                { path: "radius.sm", value: { value: 0.25, unit: "rem" } },
                { path: "radius.lg", value: { value: 1, unit: "rem" } },
            ),
        ).toEqual(["border.width", "radius"]);
    });
});
