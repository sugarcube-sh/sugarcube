import { readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { createPlainAdapter } from "../../src/adapters/plain";
import {
    getGroupPageView,
    getGroupView,
    getReferenceTargets,
    getSidebarTree,
    toTokenRow,
    getBreadcrumbs,
} from "../../src/controllers/views";
import { readDemoFiles, demoMessage, createDemoStudio } from "./demo-message";

const blue = { colorSpace: "srgb", components: [0, 0, 1] };
const navy = { colorSpace: "srgb", components: [0, 0, 0.3] };
const pink = { colorSpace: "srgb", components: [1, 0.4, 0.7] };

const files = {
    "tokens.resolver.json": JSON.stringify({
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: [{ $ref: "color.json" }] },
            {
                type: "modifier",
                name: "mode",
                default: "light",
                contexts: { light: [], dark: [{ $ref: "dark.json" }] },
            },
        ],
    }),
    "color.json": JSON.stringify({
        color: {
            $type: "color",
            bg: { $value: blue },
            text: { $description: "Foreground", default: { $value: "{color.bg}" } },
            accent: { $root: { $value: pink }, strong: { $value: "{color.accent}" } },
        },
    }),
    "dark.json": JSON.stringify({
        color: { bg: { $value: navy }, glow: { $type: "color", soft: { $value: pink } } },
    }),
};

const tokens = readFromMemory(
    { files, entryFile: "tokens.resolver.json" },
    createPlainAdapter().readOptions,
);
const { getValue } = createPlainAdapter().write(tokens);
const light = tokens.getPermutation();
const dark = tokens.getPermutation({ mode: "dark" });

describe("getSidebarTree", () => {
    it("nests every group and token, in the order the files write them", () => {
        const [color] = getSidebarTree(tokens);

        expect(color?.path).toBe("color");
        expect(color?.children.map((node) => node.name)).toEqual(["bg", "text", "accent", "glow"]);
        expect(color?.children[1]?.children.map((node) => node.path)).toEqual([
            "color.text.default",
        ]);
    });

    it("includes a group only another permutation declares", () => {
        const glow = getSidebarTree(tokens)[0]?.children.find((node) => node.name === "glow");

        expect(glow?.children.map((node) => node.path)).toEqual(["color.glow.soft"]);
    });

    it("gives a group with a $root token its own value, under the group's path", () => {
        const accent = getSidebarTree(tokens)[0]?.children.find((node) => node.name === "accent");

        expect(accent?.path).toBe("color.accent");
        expect(accent?.hasValue).toBe(true);
        expect(accent?.children.map((node) => node.path)).toEqual(["color.accent.strong"]);
    });

    it("counts the tokens at or beneath each node", () => {
        const [color] = getSidebarTree(tokens);

        expect(color?.count).toBe(5);
        expect(color?.children.find((node) => node.name === "accent")?.count).toBe(2);
    });
});

describe("getBreadcrumbs", () => {
    it("lists every group above a path, then the path", () => {
        expect(getBreadcrumbs("color.text.default")).toEqual([
            { path: "color", name: "color" },
            { path: "color.text", name: "text" },
            { path: "color.text.default", name: "default" },
        ]);
    });
});

describe("getGroupView", () => {
    it("lists a group's groups and tokens", () => {
        const view = getGroupView(light.getGroup("color.text")!, getValue);

        expect(view?.groups).toEqual([]);
        expect(view?.tokens.map((row) => row.name)).toEqual(["default"]);
    });

    it("shows what the file wrote and the value the adapter writes in the permutation shown", () => {
        const inLight = getGroupView(light.getGroup("color.text")!, getValue)?.tokens[0];
        const inDark = getGroupView(dark.getGroup("color.text")!, getValue)?.tokens[0];

        expect(inLight?.originalValue).toBe("{color.bg}");
        expect(inLight?.css).toBe(getValue(light.getToken("color.bg")!));
        expect(inDark?.css).toBe(getValue(dark.getToken("color.bg")!));
        expect(inDark?.css).not.toBe(inLight?.css);
        expect(inDark?.css).not.toContain("var(");
    });

    it("counts the tokens under each group it lists", () => {
        const view = getGroupView(dark.getGroup("color")!, getValue);

        expect(view?.groups.map((row) => [row.name, row.count])).toEqual([
            ["text", 1],
            ["accent", 2],
            ["glow", 1],
        ]);
        expect(view?.tokens.map((row) => row.name)).toEqual(["bg"]);
    });
});

describe("getGroupPageView", () => {
    it("is the group's view with its recipe's form, when the adapter offers one", () => {
        const { state } = createDemoStudio();
        const page = getGroupPageView(state, state.shownPermutation.getGroup("size.step")!);

        expect(page.form?.label).toBe("Scale");
        expect(page.tokens.map((row) => row.name)).toContain("-1");
        expect(
            getGroupPageView(state, state.shownPermutation.getGroup("color")!).form,
        ).toBeUndefined();
    });

    it("offers a group's description and deprecation, except where it is only there through $extends", () => {
        const { state } = createDemoStudio(
            demoMessage({
                entryFile: "tokens.json",
                files: {
                    "tokens.json": JSON.stringify({
                        button: {
                            $description: "The base.",
                            icon: { size: { $type: "number", $value: 1 } },
                        },
                        primary: { $extends: "{button}" },
                    }),
                },
            }),
        );
        const primary = getGroupPageView(state, state.shownPermutation.getGroup("primary")!);
        const icon = getGroupPageView(state, state.shownPermutation.getGroup("primary.icon")!);

        expect(primary.description).toEqual({ text: "The base.", editable: true, from: "button" });
        expect(primary.deprecation).toEqual({
            checkbox: { checked: false, uncheckedValue: null, message: "" },
        });
        expect(icon.description.editable).toBe(false);
        expect(icon.deprecation.checkbox).toBeUndefined();
    });

    it("says why a group lists no tokens: none at all, or only in the groups inside it", () => {
        const { state } = createDemoStudio(
            demoMessage({
                entryFile: "tokens.json",
                files: {
                    "tokens.json": JSON.stringify({
                        empty: { $type: "number" },
                        outer: { inner: { one: { $type: "number", $value: 1 } } },
                    }),
                },
            }),
        );

        expect(getGroupPageView(state, state.shownPermutation.getGroup("empty")!).noTokens).toBe(
            "at-all",
        );
        expect(getGroupPageView(state, state.shownPermutation.getGroup("outer")!).noTokens).toBe(
            "directly",
        );
        expect(
            getGroupPageView(state, state.shownPermutation.getGroup("outer.inner")!).noTokens,
        ).toBeUndefined();
    });

    it("writes each token's CSS from the theme shown, whichever theme the group came from", () => {
        const studio = createDemoStudio();
        const lightGroup = studio.state.shownPermutation.getGroup("color.text")!;
        studio.show({ mode: "dark" });
        const { state } = studio;
        const [row] = getGroupPageView(state, lightGroup).tokens;
        const darkToken = state.shownPermutation.getToken(row!.path)!;

        expect(row?.css).toBe(state.getValue(darkToken));
    });
});

describe("toTokenRow", () => {
    it("is the row a group lists for the token", () => {
        const token = dark.getToken("color.text.default")!;

        expect(toTokenRow(token, "default", getValue)).toEqual(
            getGroupView(dark.getGroup("color.text")!, getValue).tokens[0],
        );
    });
});

describe("getReferenceTargets", () => {
    it("lists every other token of the type, for the Token side of a field", () => {
        const { tokens: demo, shownPermutation } = createDemoStudio().state;

        expect(
            getReferenceTargets(demo, shownPermutation, "fontFamily", "typography.font.body"),
        ).toEqual(["typography.font.mono", "typography.font.system"]);
    });

    it("lists a token only one theme has, since a row may be that theme's", () => {
        const edited = readDemoFiles();
        const darkJson = JSON.parse(edited["dark.json"]!);
        darkJson.color.glow = { $value: "{color.brand.500}" };
        const { tokens: demo, shownPermutation } = createDemoStudio(
            demoMessage({ files: { ...edited, "dark.json": JSON.stringify(darkJson) } }),
        ).state;

        expect(shownPermutation.getToken("color.glow")).toBeUndefined();
        expect(
            getReferenceTargets(demo, shownPermutation, "color", "color.text.default"),
        ).toContain("color.glow");
    });
});
