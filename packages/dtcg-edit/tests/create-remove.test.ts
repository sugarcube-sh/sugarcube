import { defineGenerator, readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { create, remove } from "../src/index.js";
import { demo, at, opsOf, committed, resolver, opened, plainly } from "./helpers.js";
const dark = { input: { mode: "dark" } };

const refusal = (kind: string, facts: object) => ({
    refused: { kind, ...facts, reason: expect.any(String) },
});

describe("create, which file", () => {
    it("puts a shared token in the one file that writes its group", () => {
        const result = create(demo, "color.brand.950", { $value: "#0a1f44" });

        expect(opsOf(result)).toEqual([
            {
                kind: "add",
                file: "color.json",
                jsonPath: ["color", "brand", "950"],
                value: { $value: "#0a1f44" },
            },
        ]);
        expect(result.ops && result.alsoAffects.inputs).toEqual([
            { mode: "light" },
            { mode: "dark" },
        ]);
    });

    it("leaves out a file only one context reads, for a shared token", () => {
        expect(opsOf(create(demo, "color.text.accent", { $value: "{color.brand.600}" }))).toEqual([
            {
                kind: "add",
                file: "color.json",
                jsonPath: ["color", "text", "accent"],
                value: { $value: "{color.brand.600}" },
            },
        ]);
    });

    it("leaves out the default context's own file, for a shared token", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./color.json" }], {
                light: [{ $ref: "./light.json" }],
                dark: [{ $ref: "./dark.json" }],
            }),
            "color.json": '{ "color": { "$type": "color", "bg": { "$value": "#ffffff" } } }',
            "light.json": '{ "color": { "bg": { "$value": "#fafafa" } } }',
            "dark.json": '{ "color": { "bg": { "$value": "#000000" } } }',
        };

        expect(opsOf(create(opened(files), "color.accent", { $value: "#f59e0b" }))).toEqual([
            {
                kind: "add",
                file: "color.json",
                jsonPath: ["color", "accent"],
                value: { $value: "#f59e0b" },
            },
        ]);
    });

    it("puts a token for one context in that context's file", () => {
        expect(
            opsOf(create(demo, "color.text.accent", { $value: "{color.brand.300}" }, dark)),
        ).toEqual([
            {
                kind: "add",
                file: "dark.json",
                jsonPath: ["color", "text", "accent"],
                value: { $value: "{color.brand.300}" },
            },
        ]);
    });

    it("makes the group around it when no file the context may write has the group", () => {
        const value = { $value: { value: 1, unit: "rem" } };
        const result = create(demo, "radius.xl", value, dark);

        expect(opsOf(result)).toEqual([
            { kind: "add", file: "dark.json", jsonPath: ["radius", "xl"], value },
        ]);
        const after = committed(demo, result);
        expect(after.getPermutation({ mode: "dark" }).getToken("radius.xl")?.resolved).toEqual({
            value: 1,
            unit: "rem",
        });
        expect(after.getPermutation().getToken("radius.xl")).toBeUndefined();
    });

    const split = {
        "tokens.resolver.json": resolver([{ $ref: "./palette.json" }, { $ref: "./roles.json" }]),
        "palette.json":
            '{ "color": { "$type": "color", "brand": { "500": { "$value": "#3884f2" } } } }',
        "roles.json": '{ "color": { "text": { "$value": "{color.brand.500}" } } }',
    };

    it("asks which file when several write the group, and takes the answer", () => {
        const tokens = opened(split);

        const edit = create(tokens, "color.accent", { $value: "#f59e0b" });
        expect(edit.question).toMatchObject({
            kind: "placement",
            path: "color.accent",
            files: ["palette.json", "roles.json"],
        });
        expect(opsOf(edit.question?.answer("roles.json") ?? edit)).toEqual([
            {
                kind: "add",
                file: "roles.json",
                jsonPath: ["color", "accent"],
                value: { $value: "#f59e0b" },
            },
        ]);
    });

    it("doesn't ask when only one of them writes the deeper group", () => {
        expect(opsOf(create(opened(split), "color.brand.600", { $value: "#0c6ade" }))).toEqual([
            {
                kind: "add",
                file: "palette.json",
                jsonPath: ["color", "brand", "600"],
                value: { $value: "#0c6ade" },
            },
        ]);
    });

    it('refuses ".y", since no group can be named "", and never makes it at the top level', () => {
        const tokens = opened({
            "tokens.resolver.json": resolver([{ $ref: "./a.json" }]),
            "a.json": JSON.stringify({ "": { $type: "number", x: { $value: 1 } } }),
        });
        expect(create(tokens, ".y", { $value: 2 })).toEqual(refusal("invalid-name", { name: "" }));
    });

    it("adds to design tokens of one token file, read without a resolver", () => {
        const tokens = readFromMemory({
            files: { "tokens.json": '{ "a": { "$type": "number", "$value": 1 } }' },
            entryFile: "tokens.json",
        });

        expect(opsOf(create(tokens, "b", { $type: "number", $value: 2 }))).toEqual([
            {
                kind: "add",
                file: "tokens.json",
                jsonPath: ["b"],
                value: { $type: "number", $value: 2 },
            },
        ]);
    });

    it("never offers tokens written in the resolver", () => {
        const files = {
            "tokens.resolver.json": resolver([
                { a: { $type: "number", $value: 1 } },
                { $ref: "./base.json" },
            ]),
            "base.json": '{ "b": { "$type": "number", "$value": 2 } }',
        };

        expect(opsOf(create(opened(files), "c", { $type: "number", $value: 3 }))).toEqual([
            {
                kind: "add",
                file: "base.json",
                jsonPath: ["c"],
                value: { $type: "number", $value: 3 },
            },
        ]);
    });

    it("never offers a file read through a pointer", () => {
        const files = {
            "tokens.resolver.json": resolver([
                { $ref: "./all.json#/tokens" },
                { $ref: "./base.json" },
            ]),
            "all.json": '{ "tokens": { "a": { "$type": "number", "$value": 1 } } }',
            "base.json": '{ "b": { "$type": "number", "$value": 2 } }',
        };

        expect(opsOf(create(opened(files), "c", { $type: "number", $value: 3 }))).toEqual([
            {
                kind: "add",
                file: "base.json",
                jsonPath: ["c"],
                value: { $type: "number", $value: 3 },
            },
        ]);
    });
});

describe("create, groups", () => {
    it("writes a new group as {}, and a token inside it goes in the same file", () => {
        const group = create(demo, "color.raw", { group: true });

        expect(opsOf(group)).toEqual([
            { kind: "add", file: "color.json", jsonPath: ["color", "raw"], value: {} },
        ]);
        const after = committed(demo, group);
        expect(opsOf(create(after, "color.raw.blue", { $value: "#0000ff" }))).toEqual([
            {
                kind: "add",
                file: "color.json",
                jsonPath: ["color", "raw", "blue"],
                value: { $value: "#0000ff" },
            },
        ]);
    });
});

describe("create, what it refuses", () => {
    it("is refused for a name already taken", () => {
        expect(create(demo, "color.brand", { group: true })).toEqual(
            refusal("taken", { path: "color.brand" }),
        );
        expect(create(demo, "color.brand.500", { $value: "#000" })).toEqual(
            refusal("taken", { path: "color.brand.500" }),
        );
    });

    it("is refused for a name the spec forbids, naming the character", () => {
        for (const [name, character] of [
            ["$x", "$"],
            ["{x}", "{"],
            ["x}", "}"],
        ]) {
            expect(create(demo, `color.${name}`, { group: true })).toEqual(
                refusal("invalid-name", { name, character }),
            );
        }
    });

    it("is refused for an empty name", () => {
        expect(create(demo, "color.", { group: true })).toEqual(
            refusal("invalid-name", { name: "" }),
        );
        expect(create(demo, "", { group: true })).toEqual(refusal("invalid-name", { name: "" }));
    });

    it("is refused under a group that doesn't exist, or under a token", () => {
        expect(create(demo, "color.nope.x", { $value: "#000" })).toEqual(
            refusal("not-found", { path: "color.nope" }),
        );
        expect(create(demo, "color.brand.500.x", { $value: "#000" })).toEqual(
            refusal("not-a-group", { path: "color.brand.500" }),
        );
    });

    it("writes a token with no type as given, and the read reports it", () => {
        const tokens = opened({
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }]),
            "base.json": '{ "misc": { "y": { "$type": "number", "$value": 1 } } }',
        });
        const result = create(tokens, "misc.x", { $value: 2 });

        expect(opsOf(result)).toEqual([
            { kind: "add", file: "base.json", jsonPath: ["misc", "x"], value: { $value: 2 } },
        ]);
        const after = committed(tokens, result);
        expect(after.diagnostics.some(({ path }) => path === "misc.x")).toBe(true);
    });

    it("is refused for a context's own token when the token is shared, to be overridden instead", () => {
        expect(create(demo, "radius.md", { $value: { value: 1, unit: "rem" } }, dark)).toEqual(
            refusal("override-instead", { path: "radius.md", input: { mode: "dark" } }),
        );
        expect(create(demo, "color.text.brand", { $value: "{color.brand.200}" }, dark)).toEqual(
            refusal("taken", { path: "color.text.brand" }),
        );
    });
});

describe("create, for every permutation", () => {
    const read = (
        contexts: Record<string, object[]>,
        extra: Record<string, string> = {},
        more = {},
    ) =>
        readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        { type: "set", name: "base", sources: [{ $ref: "./base.json" }] },
                        { type: "modifier", name: "mode", contexts, ...more },
                    ],
                }),
                "base.json": JSON.stringify({
                    color: { $type: "color", ink: { $value: "#111111" } },
                }),
                ...extra,
            },
            entryFile: "tokens.resolver.json",
        });
    const glowInDark = { "dark.json": JSON.stringify({ color: { glow: { $value: "#ffcc00" } } }) };
    const darkFirst = { dark: [{ $ref: "./dark.json" }], light: [] };
    const lightFirst = { light: [], dark: [{ $ref: "./dark.json" }] };

    it("checks the files every permutation reads, whichever permutation the read built first", () => {
        for (const contexts of [darkFirst, lightFirst]) {
            expect(
                opsOf(create(read(contexts, glowInDark), "color.glow", { $value: "#ff0000" })),
            ).toEqual([
                {
                    kind: "add",
                    file: "base.json",
                    jsonPath: ["color", "glow"],
                    value: { $value: "#ff0000" },
                },
            ]);
        }
    });

    it("refuses a token inside one any permutation has, whichever the read built first", () => {
        const brandInDark = {
            "dark.json": JSON.stringify({ brand: { $type: "color", $value: "#e11d48" } }),
        };
        for (const contexts of [darkFirst, lightFirst]) {
            expect(
                create(read(contexts, brandInDark), "brand.x", { $value: "#ff0000" }).refused,
            ).toMatchObject({
                kind: "not-a-group",
                path: "brand",
            });
        }
    });

    it("makes a shared token of a name only the default context's own file writes", () => {
        const glowInLight = {
            "light.json": JSON.stringify({ color: { glow: { $value: "#ffcc00" } } }),
        };
        const contexts = { light: [{ $ref: "./light.json" }], dark: [] };
        const tokens = read(contexts, glowInLight, { default: "light" });
        expect(opsOf(create(tokens, "color.glow", { $value: "#ff0000" }))).toMatchObject([
            { kind: "add", file: "base.json", jsonPath: ["color", "glow"] },
        ]);
    });
});

describe("remove", () => {
    it('is refused for the top level, "", which holds everything in its files', () => {
        expect(remove(demo, "")).toEqual(refusal("top-level", {}));
    });

    it("takes a token out, leaving its siblings in order, and lists what pointed at it", () => {
        const result = remove(demo, "color.brand.500");
        const pointing = [
            ...new Set(
                demo.permutations.flatMap(({ tokens }) =>
                    tokens
                        .filter(({ references }) =>
                            references.some(
                                ({ pointsToPath }) => pointsToPath === "color.brand.500",
                            ),
                        )
                        .map(({ path }) => path),
                ),
            ),
        ];

        expect(pointing.length).toBeGreaterThan(0);
        expect(plainly(result)).toEqual({
            ops: [
                {
                    kind: "remove",
                    file: "color.json",
                    jsonPath: ["color", "brand", "500"],
                    was: at(demo, "color.json", ["color", "brand", "500"]),
                },
            ],
            alsoAffects: [{ mode: "light" }, { mode: "dark" }],
            broken: pointing,
            moved: [],
        });
        const after = committed(demo, result);
        const brand = Object.keys(at(demo, "color.json", ["color", "brand"]) as object);
        expect(Object.keys(at(after, "color.json", ["color", "brand"]) as object)).toEqual(
            brand.filter((key) => key !== "500"),
        );
    });

    it("takes out every copy: the one that wins, one it replaces, and each context's own", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }, { $ref: "./brand.json" }], {
                light: [],
                dark: [{ $ref: "./dark.json" }],
            }),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
            "brand.json": '{ "bg": { "$type": "color", "$value": "#fafafa" } }',
            "dark.json": '{ "bg": { "$type": "color", "$value": "#000000" } }',
        };
        const tokens = opened(files);
        const result = remove(tokens, "bg");

        expect(opsOf(result).map(({ file }) => file)).toEqual([
            "base.json",
            "brand.json",
            "dark.json",
        ]);
        const after = committed(tokens, result);
        expect(after.getPermutation().getToken("bg")).toBeUndefined();
        expect(after.getPermutation({ mode: "dark" }).getToken("bg")).toBeUndefined();
    });

    it("takes out a group and everything under it, listing only what points in from outside", () => {
        const result = remove(demo, "color.brand");
        const inside = (demo.getPermutation().getGroup("color.brand")?.tokens ?? []).map(
            ({ path }) => path,
        );

        expect(opsOf(result)).toEqual([
            {
                kind: "remove",
                file: "color.json",
                jsonPath: ["color", "brand"],
                was: at(demo, "color.json", ["color", "brand"]),
            },
        ]);
        const broken = result.ops ? (result.broken ?? []) : [];
        expect(broken.length).toBeGreaterThan(0);
        expect(broken.filter((path) => inside.includes(path))).toEqual([]);
        expect(
            committed(demo, result).getPermutation().getGroup("color.brand")?.tokens ?? [],
        ).toEqual([]);
    });

    it("leaves out of broken a token inside the group that refers to another inside it", () => {
        const tokens = opened({
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }]),
            "base.json": JSON.stringify({
                brand: {
                    $type: "number",
                    base: { $value: 1 },
                    fill: { $value: "{brand.base}" },
                },
                button: { $type: "number", $value: "{brand.fill}" },
            }),
        });

        expect(remove(tokens, "brand")).toMatchObject({ broken: ["button"] });
    });

    it("names a token once in broken when it refers to two things inside the group", () => {
        const tokens = opened({
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }]),
            "base.json": JSON.stringify({
                space: {
                    $type: "dimension",
                    x: { $value: { value: 1, unit: "px" } },
                    y: { $value: { value: 2, unit: "px" } },
                },
                lifted: {
                    $type: "shadow",
                    $value: {
                        color: { colorSpace: "srgb", components: [0, 0, 0] },
                        offsetX: "{space.x}",
                        offsetY: "{space.y}",
                        blur: { value: 0, unit: "px" },
                        spread: { value: 0, unit: "px" },
                    },
                },
            }),
        });

        expect(remove(tokens, "space")).toMatchObject({ broken: ["lifted"] });
    });

    it("names no context in design tokens without modifiers", () => {
        const tokens = opened({
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }]),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
        });

        const removed = remove(tokens, "bg");
        expect(removed.ops && removed.alsoAffects.inputs).toEqual([]);
    });

    it("is refused for a path that is neither a token nor a group", () => {
        expect(remove(demo, "color.nope")).toEqual(refusal("not-found", { path: "color.nope" }));
    });

    it("is refused for a token a generator makes, or a group inherits", () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
            generate: () => ({
                ok: true,
                value: [{ name: "1", $value: { value: 1, unit: "rem" } }],
            }),
        });
        const generated = opened(
            {
                "tokens.resolver.json": resolver([{ $ref: "./space.json" }]),
                "space.json": JSON.stringify({
                    space: { $type: "dimension", $extensions: { "com.example": { steps: 1 } } },
                }),
            },
            { generators: [steps] },
        );
        const inherited = opened({
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }]),
            "base.json": JSON.stringify({
                button: {
                    $type: "color",
                    bg: { $value: "#ffffff" },
                    state: { hover: { $value: "#eeeeee" } },
                },
                danger: { $extends: "{button}" },
            }),
        });

        expect(remove(generated, "space.1")).toEqual(
            refusal("generated", {
                path: "space.1",
                from: "space",
                extension: ["com.example", "steps"],
            }),
        );
        expect(remove(inherited, "danger.bg")).toEqual(
            refusal("inherited", { path: "danger.bg", from: "button" }),
        );
        expect(remove(inherited, "danger.state")).toEqual(
            refusal("inherited", { path: "danger.state", from: "button" }),
        );
    });
});
