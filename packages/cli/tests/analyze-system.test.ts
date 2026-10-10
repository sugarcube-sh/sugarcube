import { describe, expect, it } from "vitest";
import { systemOf, unusedTokens, usageRoots } from "../src/analyze/system.js";
import { buildFiles } from "../src/build.js";
import type { VarRef } from "../src/lint/scan-css.js";

const color = (value: unknown) => ({ $type: "color", $value: value });
const black = { colorSpace: "srgb", components: [0, 0, 0] };

function ref(name: string): VarRef {
    return { name, line: 1, file: "a.css" };
}

async function systemFrom(files: Record<string, unknown>) {
    const texts = Object.fromEntries(
        Object.entries(files).map(([name, json]) => [name, JSON.stringify(json)]),
    );
    return systemOf(await buildFiles(texts, "/project"));
}

const resolver = {
    version: "2025.10",
    sets: {
        palette: {
            sources: [{ $ref: "palette.json" }],
            $extensions: { "sh.sugarcube": { emit: false } },
        },
        base: { sources: [{ $ref: "base.json" }] },
    },
    resolutionOrder: [
        { $ref: "#/sets/palette" },
        { $ref: "#/sets/base" },
        {
            type: "modifier",
            name: "theme",
            default: "light",
            contexts: { light: [], dark: [{ $ref: "dark.json" }] },
        },
    ],
};

const themed = {
    "tokens.resolver.json": resolver,
    "palette.json": { hidden: { via: color("{color.target}"), lonely: color(black) } },
    "base.json": {
        color: {
            "target": color(black),
            "through-private": color("{hidden.via}"),
            "pointed": color(black),
            "pointer": color({ $ref: "#/color/pointed/$value" }),
            "surface": color("{color.target}"),
            "night": color(black),
            "orphan": color(black),
        },
        text: {
            base: {
                $type: "typography",
                $value: {
                    fontFamily: "Inter",
                    fontSize: { value: 1, unit: "rem" },
                    fontWeight: 400,
                    letterSpacing: { value: 0, unit: "rem" },
                    lineHeight: 1.5,
                },
            },
        },
    },
    "dark.json": { color: { surface: color("{color.night}") } },
};

describe("usageRoots", () => {
    it("maps a used var name back to its token path", async () => {
        const system = await systemFrom(themed);

        expect([...usageRoots(system, [ref("--color-target")])]).toEqual(["color.target"]);
    });

    it("maps a typography sub-property var to its base token", async () => {
        const system = await systemFrom(themed);

        expect([...usageRoots(system, [ref("--text-base-font-family")])]).toEqual(["text.base"]);
    });

    it("drops references that aren't sugarcube tokens", async () => {
        const system = await systemFrom(themed);

        expect([...usageRoots(system, [ref("--sl-color-text")])]).toEqual([]);
    });

    it("de-dupes the same token referenced from multiple places", async () => {
        const system = await systemFrom(themed);
        const roots = usageRoots(system, [ref("--color-target"), ref("--color-target")]);

        expect([...roots]).toEqual(["color.target"]);
    });
});

describe("unusedTokens", () => {
    const unused = async (...names: string[]) => {
        const system = await systemFrom(themed);
        return unusedTokens(system, usageRoots(system, names.map(ref)));
    };

    it("lists private tokens too, as tokens of the system", async () => {
        expect(await unused()).toContain("hidden.lonely");
        expect((await systemFrom(themed)).tokens.has("hidden.via")).toBe(true);
    });

    it("follows a chain of references through a private token", async () => {
        const left = await unused("--color-through-private");

        expect(left).not.toContain("hidden.via");
        expect(left).not.toContain("color.target");
    });

    it("counts a pointer as using the token it points into", async () => {
        expect(await unused("--color-pointer")).not.toContain("color.pointed");
    });

    it("counts what any permutation it writes reaches", async () => {
        const left = await unused("--color-surface");

        expect(left).not.toContain("color.target");
        expect(left).not.toContain("color.night");
        expect(left).toContain("color.orphan");
    });

    it("lists them in sorted order", async () => {
        const left = await unused();

        expect(left).toStrictEqual([...left].sort());
    });
});
