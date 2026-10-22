import { readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { plain } from "../../src/adapters/plain";
import {
    groupPage,
    groupView,
    referable,
    sidebarTree,
    tokenRow,
    trail,
} from "../../src/controllers/views";
import { demoFiles, demoMessage, studioOn } from "./demo-message";

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

const tokens = readFromMemory({ files, entry: "tokens.resolver.json" }, plain().read);
const { value } = plain().write(tokens);
const light = tokens.permutation();
const dark = tokens.permutation({ mode: "dark" });

describe("sidebarTree", () => {
    it("nests every group and token, in the order the files write them", () => {
        const [color] = sidebarTree(tokens);

        expect(color?.path).toBe("color");
        expect(color?.children.map((node) => node.name)).toEqual(["bg", "text", "accent", "glow"]);
        expect(color?.children[1]?.children.map((node) => node.path)).toEqual([
            "color.text.default",
        ]);
    });

    it("includes a group only another permutation declares", () => {
        const glow = sidebarTree(tokens)[0]?.children.find((node) => node.name === "glow");

        expect(glow?.children.map((node) => node.path)).toEqual(["color.glow.soft"]);
    });

    it("gives a group with a $root token its own value, under the group's path", () => {
        const accent = sidebarTree(tokens)[0]?.children.find((node) => node.name === "accent");

        expect(accent?.path).toBe("color.accent");
        expect(accent?.hasValue).toBe(true);
        expect(accent?.children.map((node) => node.path)).toEqual(["color.accent.strong"]);
    });

    it("counts the tokens at or beneath each node", () => {
        const [color] = sidebarTree(tokens);

        expect(color?.count).toBe(5);
        expect(color?.children.find((node) => node.name === "accent")?.count).toBe(2);
    });
});

describe("trail", () => {
    it("lists every group above a path, then the path", () => {
        expect(trail("color.text.default")).toEqual([
            { path: "color", name: "color" },
            { path: "color.text", name: "text" },
            { path: "color.text.default", name: "default" },
        ]);
    });
});

describe("groupView", () => {
    it("lists a group's groups and tokens", () => {
        const view = groupView(light.group("color.text")!, value);

        expect(view?.groups).toEqual([]);
        expect(view?.tokens.map((row) => row.name)).toEqual(["default"]);
    });

    it("shows what the file wrote and the value the adapter writes in the permutation shown", () => {
        const inLight = groupView(light.group("color.text")!, value)?.tokens[0];
        const inDark = groupView(dark.group("color.text")!, value)?.tokens[0];

        expect(inLight?.written).toBe("{color.bg}");
        expect(inLight?.css).toBe(value(light.token("color.bg")!));
        expect(inDark?.css).toBe(value(dark.token("color.bg")!));
        expect(inDark?.css).not.toBe(inLight?.css);
        expect(inDark?.css).not.toContain("var(");
    });

    it("counts the tokens under each group it lists", () => {
        const view = groupView(dark.group("color")!, value);

        expect(view?.groups.map((row) => [row.name, row.count])).toEqual([
            ["text", 1],
            ["accent", 2],
            ["glow", 1],
        ]);
        expect(view?.tokens.map((row) => row.name)).toEqual(["bg"]);
    });
});

describe("groupPage", () => {
    it("is the group's view with its recipe's form, when the adapter offers one", () => {
        const { state } = studioOn();
        const page = groupPage(state, state.showing.group("size.step")!);

        expect(page.form?.label).toBe("Scale");
        expect(page.tokens.map((row) => row.name)).toContain("-1");
        expect(groupPage(state, state.showing.group("color")!).form).toBeUndefined();
    });

    it("offers a group's description and deprecation, except where it is only there through $extends", () => {
        const { state } = studioOn(
            demoMessage({
                entry: "tokens.json",
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
        const primary = groupPage(state, state.showing.group("primary")!);
        const icon = groupPage(state, state.showing.group("primary.icon")!);

        expect(primary.description).toEqual({ text: "The base.", editable: true, from: "button" });
        expect(primary.deprecation).toEqual({ box: { checked: false, untick: null, message: "" } });
        expect(icon.description.editable).toBe(false);
        expect(icon.deprecation.box).toBeUndefined();
    });

    it("says why a group lists no tokens: none at all, or only in the groups inside it", () => {
        const { state } = studioOn(
            demoMessage({
                entry: "tokens.json",
                files: {
                    "tokens.json": JSON.stringify({
                        empty: { $type: "number" },
                        outer: { inner: { one: { $type: "number", $value: 1 } } },
                    }),
                },
            }),
        );

        expect(groupPage(state, state.showing.group("empty")!).noTokens).toBe("at-all");
        expect(groupPage(state, state.showing.group("outer")!).noTokens).toBe("directly");
        expect(groupPage(state, state.showing.group("outer.inner")!).noTokens).toBeUndefined();
    });

    it("writes each token's CSS from the theme shown, whichever theme the group came from", () => {
        const studio = studioOn();
        const lightGroup = studio.state.showing.group("color.text")!;
        studio.show({ mode: "dark" });
        const { state } = studio;
        const [row] = groupPage(state, lightGroup).tokens;
        const darkToken = state.showing.token(row!.path)!;

        expect(row?.css).toBe(state.value(darkToken));
    });
});

describe("tokenRow", () => {
    it("is the row a group lists for the token", () => {
        const token = dark.token("color.text.default")!;

        expect(tokenRow(token, "default", value)).toEqual(
            groupView(dark.group("color.text")!, value).tokens[0],
        );
    });
});

describe("referable", () => {
    it("lists every other token of the type, for the Token side of a field", () => {
        const { tokens: demo, showing } = studioOn().state;

        expect(referable(demo, showing, "fontFamily", "typography.font.body")).toEqual([
            "typography.font.mono",
            "typography.font.system",
        ]);
    });

    it("lists a token only one theme has, since a row may be that theme's", () => {
        const edited = demoFiles();
        const darkJson = JSON.parse(edited["dark.json"]!);
        darkJson.color.glow = { $value: "{color.brand.500}" };
        const { tokens: demo, showing } = studioOn(
            demoMessage({ files: { ...edited, "dark.json": JSON.stringify(darkJson) } }),
        ).state;

        expect(showing.token("color.glow")).toBeUndefined();
        expect(referable(demo, showing, "color", "color.text.default")).toContain("color.glow");
    });
});
