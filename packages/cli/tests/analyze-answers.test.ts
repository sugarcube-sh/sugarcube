import { fillDefaults, createReadOptions } from "@sugarcube-sh/core";
import { readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { type Analysis, findImpact, findUnused, findDefinitions } from "../src/analyze/answers.js";
import type { TokenUse } from "../src/analyze/uses.js";
import { buildFromMemory, buildFromTokens } from "../src/build.js";

const color = (value: unknown) => ({ $type: "color", $value: value });
const black = { colorSpace: "srgb", components: [0, 0, 0] };

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
            "on-surface": color("{color.surface}"),
        },
        group: { $root: color("{color.target}") },
        route: { a: color("{color.target}"), b: color("{color.target}") },
        switch: color("{route.a}"),
    },
    "dark.json": { color: { surface: color("{color.night}") }, switch: color("{route.b}") },
};

const use = (token: string, file = "/project/app.css", line = 1): TokenUse => ({
    token,
    file,
    line,
    var: `--${token.replaceAll(".", "-")}`,
});

async function analysisOf(...uses: TokenUse[]): Promise<Analysis> {
    const texts = Object.fromEntries(
        Object.entries(themed).map(([name, json]) => [name, JSON.stringify(json)]),
    );
    const { tokens } = await buildFromMemory(texts, "tokens.resolver.json");
    return {
        tokens,
        uses: {
            uses,
            scanned: { stylesheets: ["/project/app.css"], markup: [] },
            unread: [],
        },
    };
}

function impactOf(analysis: Analysis, path: string) {
    const written = findDefinitions(analysis.tokens, path);
    if (!written || written === "group") throw new Error(`no token ${path}`);
    return findImpact(analysis, path, written);
}

describe("unused", () => {
    it("lists private tokens too, as tokens of the system, and counts them", async () => {
        const answer = findUnused(await analysisOf());

        expect(answer.unused).toContain("hidden.lonely");
        expect(answer.total).toBe(14);
    });

    it("follows a chain of references through a private token", async () => {
        const { unused: left } = findUnused(await analysisOf(use("color.through-private")));

        expect(left).not.toContain("hidden.via");
        expect(left).not.toContain("color.target");
    });

    it("counts a pointer as using the token it points into", async () => {
        expect(findUnused(await analysisOf(use("color.pointer"))).unused).not.toContain(
            "color.pointed",
        );
    });

    it("counts what any permutation it writes reaches", async () => {
        const { unused: left } = findUnused(await analysisOf(use("color.surface")));

        expect(left).not.toContain("color.target");
        expect(left).not.toContain("color.night");
        expect(left).toContain("color.orphan");
    });

    it("lists them in sorted order", async () => {
        const { unused: left } = findUnused(await analysisOf());

        expect(left).toStrictEqual([...left].sort());
    });
});

describe("impact", () => {
    it("gives the token, what reaches it and what each refers to on the way", async () => {
        const answer = impactOf(await analysisOf(), "color.target");

        expect(answer.path).toBe("color.target");
        expect(answer.dependents).toStrictEqual([
            {
                path: "color.on-surface",
                references: ["color.surface"],
                defaultReference: "color.surface",
            },
            {
                path: "color.surface",
                references: ["color.target"],
                defaultReference: "color.target",
            },
            {
                path: "color.through-private",
                references: ["hidden.via"],
                defaultReference: "hidden.via",
            },
            { path: "group.$root", references: ["color.target"], defaultReference: "color.target" },
            { path: "hidden.via", references: ["color.target"], defaultReference: "color.target" },
            { path: "route.a", references: ["color.target"], defaultReference: "color.target" },
            { path: "route.b", references: ["color.target"], defaultReference: "color.target" },
            {
                path: "switch",
                references: ["route.a", "route.b"],
                defaultReference: "route.a",
                label: "per theme",
            },
        ]);
    });

    it("keeps only the uses of the token and what reaches it", async () => {
        const answer = impactOf(
            await analysisOf(
                use("color.surface"),
                use("color.orphan"),
                use("color.target", "/project/b.css", 4),
            ),
            "color.target",
        );

        expect(answer.uses.map(({ token }) => token)).toStrictEqual([
            "color.surface",
            "color.target",
        ]);
    });

    it("names the default permutation's reference only where it holds there", async () => {
        const answer = impactOf(await analysisOf(), "color.night");

        expect(answer.dependents).toContainEqual({
            path: "color.on-surface",
            references: ["color.surface"],
        });
        expect(answer.dependents).toContainEqual({
            path: "color.surface",
            references: ["color.night"],
        });
    });
});

describe("findDefinitions", () => {
    it("says when a path is a group, not a token", async () => {
        expect(findDefinitions((await analysisOf()).tokens, "color")).toBe("group");
    });

    it("says when a path is nothing", async () => {
        expect(findDefinitions((await analysisOf()).tokens, "nowhere")).toBeUndefined();
    });

    it("gives each value written where it wins, in the order written, whichever theme is read first", () => {
        const config = fillDefaults({
            variables: {
                permutations: [
                    { input: { theme: "dark" }, selector: ".dark" },
                    { input: { theme: "light" }, selector: ":root" },
                ],
            },
        });
        const texts = Object.fromEntries(
            Object.entries(themed).map(([name, json]) => [name, JSON.stringify(json)]),
        );
        const tokens = readFromMemory({ files: texts }, createReadOptions(config));
        expect(tokens.permutations[0]?.input).toStrictEqual({ theme: "dark" });
        const written = findDefinitions(tokens, "color.surface");
        if (!written || written === "group") throw new Error("no color.surface");
        expect(
            written.map(({ token, file, permutations }) => [
                token.original?.value,
                file,
                permutations.inputs,
            ]),
        ).toStrictEqual([
            ["{color.target}", "base.json", [{ theme: "light" }]],
            ["{color.night}", "dark.json", [{ theme: "dark" }]],
        ]);
    });
});

describe("impact, across themes", () => {
    const dimension = (value: unknown) => ({ $type: "dimension", $value: value });
    const blue = { colorSpace: "srgb", components: [0, 0, 1] };
    const files = {
        "tokens.resolver.json": {
            version: "2025.10",
            resolutionOrder: [
                { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                {
                    type: "modifier",
                    name: "theme",
                    default: "light",
                    contexts: {
                        light: [],
                        dark: [{ $ref: "dark.json" }],
                        alt: [{ $ref: "alt.json" }],
                    },
                },
                {
                    type: "modifier",
                    name: "brand",
                    default: "a",
                    contexts: { a: [], b: [{ $ref: "b.json" }] },
                },
                {
                    type: "modifier",
                    name: "debug",
                    default: "off",
                    contexts: { off: [], on: [] },
                },
            ],
        },
        "base.json": {
            red: color({ colorSpace: "srgb", components: [1, 0, 0] }),
            blue: color(blue),
            brand: color("{red}"),
            danger: color("{brand}"),
            edge: { $type: "border", $value: { color: "{brand}", width: "{gap}", style: "solid" } },
            gap: dimension({ value: 1, unit: "px" }),
            soft: color("{blue}"),
            strong: color("{blue}"),
            muted: color("{blue}"),
            button: color("{soft}"),
            surface: color("{soft}"),
            mixed: color("{soft}"),
            only: color("{soft}"),
            size: dimension({ value: 1, unit: "px" }),
            small: dimension("{size}"),
            large: dimension("{size}"),
            lift: {
                $type: "shadow",
                $value: {
                    color: "{blue}",
                    offsetX: "{small}",
                    offsetY: "{large}",
                    blur: { value: 0, unit: "px" },
                    spread: { value: 0, unit: "px" },
                },
            },
        },
        "dark.json": {
            brand: color("{blue}"),
            button: color("{soft}"),
            surface: color("{strong}"),
            mixed: color("{strong}"),
        },
        "alt.json": { surface: color("{soft}") },
        "b.json": { button: color("{strong}"), mixed: color("{muted}") },
    };
    const texts = (changed: Record<string, unknown> = {}) =>
        Object.fromEntries(
            Object.entries({ ...files, ...changed }).map(([name, json]) => [
                name,
                JSON.stringify(json),
            ]),
        );
    const noUses = {
        uses: [],
        scanned: { stylesheets: [], markup: [] },
        unread: [],
    };
    const dependentsOf = async (
        path: string,
        built?: Awaited<ReturnType<typeof buildFromMemory>>,
    ) => {
        const { tokens } = built ?? (await buildFromMemory(texts(), "tokens.resolver.json"));
        const written = findDefinitions(tokens, path);
        if (!written || written === "group") throw new Error(`no token ${path}`);
        return new Map(
            findImpact({ tokens, uses: noUses }, path, written).dependents.map((each) => [
                each.path,
                each,
            ]),
        );
    };

    it("gives what reaches a token in any theme, through the references that reach it", async () => {
        const reaching = await dependentsOf("red");
        expect(reaching.get("brand")).toStrictEqual({
            path: "brand",
            references: ["red"],
            defaultReference: "red",
        });
        expect(reaching.get("danger")?.references).toStrictEqual(["brand"]);
        expect(reaching.get("edge")?.references).toStrictEqual(["brand"]);
    });

    it("never lists the token as depending on itself, round a loop", async () => {
        const { tokens } = await buildFromMemory(
            {
                "tokens.json": JSON.stringify({
                    a: { $type: "number", $value: "{b}" },
                    b: { $type: "number", $value: "{a}" },
                }),
            },
            "tokens.json",
        );
        const a = findDefinitions(tokens, "a");
        if (!a || a === "group") throw new Error("no a");
        expect(findImpact({ tokens, uses: noUses }, "a", a).dependents).toStrictEqual([
            { path: "b", references: ["a"], defaultReference: "a" },
        ]);
    });

    it("names the modifier whose files set the token to another reference", async () => {
        const reaching = await dependentsOf("blue");
        expect(reaching.get("button")?.label).toBe("per brand");
        expect(reaching.get("surface")?.label).toBe("per theme");
    });

    it("names no modifier when every file that writes the token names the same references", async () => {
        const pair = {
            $type: "gradient",
            $value: [
                { color: "{soft}", position: 0 },
                { color: "{strong}", position: 1 },
            ],
        };
        const built = await buildFromMemory(
            texts({
                "dark.json": { ...files["dark.json"], pair },
                "alt.json": { ...files["alt.json"], pair },
            }),
            "tokens.resolver.json",
        );
        expect((await dependentsOf("blue", built)).get("pair")?.label).toBe("2 references");
    });

    it("says 'per context' when more than one modifier sets it", async () => {
        expect((await dependentsOf("blue")).get("mixed")?.label).toBe("per context");
    });

    it("says nothing about a token with a single parent", async () => {
        expect((await dependentsOf("blue")).get("only")).not.toHaveProperty("label");
    });

    it("names the modifier whose files set it, even when another lines up by chance", async () => {
        const config = fillDefaults({
            variables: {
                permutations: [
                    { input: { theme: "light", brand: "a" }, selector: ":root" },
                    { input: { theme: "dark", brand: "b" }, selector: ".dark-b" },
                ],
            },
        });
        const tokens = readFromMemory(
            { files: texts({ "dark.json": {} }) },
            createReadOptions(config),
        );
        const loaded = { config: { ...config, resolver: "tokens.resolver.json" } };
        const built = await buildFromTokens(tokens, loaded);
        expect((await dependentsOf("blue", built)).get("button")?.label).toBe("per brand");
    });

    it("ignores a context's file that a later source always overrides", () => {
        const layer = (from: string) => ({
            color: from,
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 0, unit: "px" },
            blur: { value: 0, unit: "px" },
            spread: { value: 0, unit: "px" },
        });
        const shadow = (...colors: string[]) => ({ $type: "shadow", $value: colors.map(layer) });
        const tokens = readFromMemory({
            files: Object.fromEntries(
                Object.entries({
                    "tokens.resolver.json": {
                        version: "2025.10",
                        resolutionOrder: [
                            { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                            {
                                type: "modifier",
                                name: "theme",
                                default: "light",
                                contexts: { light: [], dark: [{ $ref: "dark.json" }] },
                            },
                            { type: "set", name: "fixed", sources: [{ $ref: "fixed.json" }] },
                        ],
                    },
                    "base.json": { blue: color(blue), strong: color("{blue}") },
                    "dark.json": { lift: shadow("{strong}") },
                    "fixed.json": { lift: shadow("{blue}", "{strong}") },
                }).map(([name, json]) => [name, JSON.stringify(json)]),
            ),
        });
        const written = findDefinitions(tokens, "blue");
        if (!written || written === "group") throw new Error("no blue");
        const lift = findImpact({ tokens, uses: noUses }, "blue", written).dependents.find(
            ({ path }) => path === "lift",
        );
        expect(lift?.label).toBe("2 references");
    });

    it("says how many references when the parents don't vary by theme", async () => {
        expect((await dependentsOf("size")).get("lift")?.label).toBe("2 references");
    });
});
