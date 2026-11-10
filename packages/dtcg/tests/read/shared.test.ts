import { describe, expect, it } from "vitest";
import { type Permutation, defineGenerator, readFromMemory } from "../../src/index.js";
import { lightDark } from "../token-files.js";

const rgb = (red: number) => ({ colorSpace: "srgb", components: [red, 0, 0] });

const steps = defineGenerator({
    extension: ["com.example", "steps"],
    messages: {},
    generate: (_group, count: unknown) => ({
        ok: true,
        value: Array.from({ length: Number(count) }, (_, i) => ({
            name: `${i + 1}`,
            $value: i + 1,
        })),
    }),
});

const read = (dark: unknown) =>
    readFromMemory(
        {
            files: {
                "tokens.resolver.json": lightDark(["base.json"], ["dark.json"]),
                "base.json": JSON.stringify({
                    color: {
                        $type: "color",
                        red: { $value: rgb(1) },
                        blue: { $value: { colorSpace: "srgb", components: [0, 0, 1] } },
                        brand: { $value: "{color.red}" },
                        text: { $value: "{color.brand}" },
                        accent: { $value: "{color.blue}" },
                    },
                    level: {
                        $type: "number",
                        red: { $value: { $ref: "#/color/red/$value/components/0" } },
                        blue: { $value: { $ref: "#/color/blue/$value/components/2" } },
                    },
                    space: { $type: "number", sm: { $value: 4 }, md: { $value: 8 } },
                    size: { $type: "number", sm: { $value: 1 } },
                    step: { $type: "number", $extensions: { "com.example": { steps: 2 } } },
                }),
                "dark.json": JSON.stringify(dark),
            },
        },
        { generators: [steps] },
    );

const tokens = read({
    color: { red: { $value: rgb(0.5) } },
    size: { $deprecated: true },
});
const light = tokens.getPermutation({ mode: "light" });
const dark = tokens.getPermutation({ mode: "dark" });
const same = (path: string) => light.getToken(path) === dark.getToken(path);

describe("a token the same in two permutations", () => {
    it("is one object when it is written in the same place and points at nothing", () => {
        expect(light.getToken("color.blue")).toBeDefined();
        expect(same("color.blue")).toBe(true);
        expect(same("space.sm")).toBe(true);
    });

    it("is one object when everything it points at is", () => {
        expect(same("color.accent")).toBe(true);
        expect(dark.getToken("color.accent")?.references[0]?.pointsToToken).toBe(
            dark.getToken("color.blue"),
        );
    });

    it("is one object when a JSON Pointer reaches inside a value that is the same", () => {
        expect(same("level.blue")).toBe(true);
    });

    it("is one object when a generator hands back the same tokens for the same extension", () => {
        expect(light.getToken("step.1")).toBeDefined();
        expect(same("step.1")).toBe(true);
        expect(same("step.2")).toBe(true);
    });
});

describe("a token that differs between permutations", () => {
    it("is two objects when a later file writes it", () => {
        expect(same("color.red")).toBe(false);
    });

    it("is two objects when it points at a token that is", () => {
        expect(same("color.brand")).toBe(false);
        expect(same("color.text")).toBe(false);
        expect(dark.getToken("color.text")?.references[0]?.pointsToToken).toBe(
            dark.getToken("color.brand"),
        );
        expect(light.getToken("color.text")?.references[0]?.pointsToToken).toBe(
            light.getToken("color.brand"),
        );
    });

    it("is two objects when a JSON Pointer reaches inside a value that differs", () => {
        expect(same("level.red")).toBe(false);
        expect(light.getToken("level.red")?.resolved).toBe(1);
        expect(dark.getToken("level.red")?.resolved).toBe(0.5);
    });

    it("is two objects when what it takes from its group differs", () => {
        expect(dark.getToken("size.sm")?.deprecated).toBe(true);
        expect(same("size.sm")).toBe(false);
    });

    it("is two objects when a permutation writes its own extension for the generator", () => {
        const own = read({ step: { $extensions: { "com.example": { steps: 3 } } } });
        const ownLight = own.getPermutation({ mode: "light" });
        const ownDark = own.getPermutation({ mode: "dark" });
        expect(ownDark.getToken("step.3")).toBeDefined();
        expect(ownLight.getToken("step.1")).not.toBe(ownDark.getToken("step.1"));
    });
});

describe("a group the same in two permutations", () => {
    it("is one object when its own facts and every child are", () => {
        expect(light.getGroup("space")).toBe(dark.getGroup("space"));
        expect(light.getGroup("step")).toBe(dark.getGroup("step"));
    });

    it("is two objects when a child differs", () => {
        expect(light.getGroup("color")).not.toBe(dark.getGroup("color"));
        expect(dark.getGroup("color")?.children).toContain(dark.getToken("color.blue"));
        expect(light.getGroup("color")?.children).toContain(light.getToken("color.blue"));
    });

    it("is two objects when its own facts differ", () => {
        expect(light.getGroup("size")).not.toBe(dark.getGroup("size"));
    });
});

describe("each permutation's own answers about a shared token", () => {
    it("still name only that permutation's users", () => {
        const users = (permutation: Permutation) =>
            permutation.getDependents("color.red").map(({ path }) => path);
        expect(users(light)).toStrictEqual(["color.brand", "level.red"]);
        expect(
            dark.getDependents("color.red").every((user) => dark.getToken(user.path) === user),
        ).toBe(true);
    });

    it("still list every token in the order the files write them", () => {
        expect(light.tokens.map(({ path }) => path)).toStrictEqual(
            dark.tokens.map(({ path }) => path),
        );
        expect(light.tokens.map(({ path }) => path).slice(0, 5)).toStrictEqual([
            "color.red",
            "color.blue",
            "color.brand",
            "color.text",
            "color.accent",
        ]);
    });
});

describe("a loop", () => {
    const looped = readFromMemory({
        files: {
            "tokens.resolver.json": lightDark(["base.json"], ["dark.json"]),
            "base.json": JSON.stringify({
                loop: { $type: "number", a: { $value: "{loop.b}" }, b: { $value: "{loop.a}" } },
                x: { a: { $extends: "{y}", $type: "number", n: { $value: 1 } } },
                y: { b: { $extends: "{x}" } },
            }),
            "dark.json": JSON.stringify({ other: { $type: "number", $value: 1 } }),
        },
    });

    it("of references links each permutation's tokens to its own", () => {
        for (const permutation of looped.permutations) {
            const [a, b] = [permutation.getToken("loop.a"), permutation.getToken("loop.b")];
            expect(a?.references[0]?.pointsToToken).toBe(b);
            expect(b?.references[0]?.pointsToToken).toBe(a);
        }
    });

    it("through children and $extends is reported, and every group is still built", () => {
        expect(looped.diagnostics.map(({ kind, path }) => [kind, path])).toContainEqual([
            "circular-reference",
            "x.a",
        ]);
        for (const permutation of looped.permutations) {
            expect(permutation.getGroup("x.a")?.extends).toBeUndefined();
            expect(permutation.getGroup("x")?.children).toContain(permutation.getGroup("x.a"));
            expect(permutation.getGroup("y")?.children).toContain(permutation.getGroup("y.b"));
        }
    });
});

describe("what resolving a shared token finds", () => {
    const found = readFromMemory({
        files: {
            "tokens.resolver.json": lightDark(["base.json"], ["dark.json"], { dim: [] }),
            "base.json": JSON.stringify({
                color: {
                    $type: "color",
                    red: { $value: rgb(1) },
                    lost: { $value: "{color.missing}" },
                    grouped: { $value: "{space}" },
                    edge: {
                        $type: "border",
                        $value: {
                            color: "{space.sm}",
                            width: { value: 1, unit: "px" },
                            style: "solid",
                        },
                    },
                },
                space: { $type: "number", sm: { $value: 4 } },
            }),
            "dark.json": JSON.stringify({ color: { red: { $value: rgb(0.5) } } }),
        },
    });
    const kinds = (path: string) =>
        found
            .getDiagnostics(path)
            .map(({ kind, permutations }) => `${kind} in ${permutations.label}`);

    it("is shared too, naming every permutation that shares the token", () => {
        const [inLight, inDark, inDim] = ["light", "dark", "dim"].map((mode) =>
            found.getPermutation({ mode }),
        );
        expect(inLight?.getToken("color.lost")).toBe(inDim?.getToken("color.lost"));
        expect(inLight?.getToken("color.lost")).toBe(inDark?.getToken("color.lost"));
        expect(kinds("color.lost")).toStrictEqual(["missing-reference in every permutation"]);
        expect(kinds("color.grouped")).toStrictEqual(["not-a-token in every permutation"]);
        expect(kinds("color.edge")).toStrictEqual(["type-mismatch in every permutation"]);
    });

    it("is the same as every permutation resolving it again would find", () => {
        for (const permutation of found.permutations) {
            expect(permutation.getDiagnostics("color.lost").map(({ kind }) => kind)).toStrictEqual([
                "missing-reference",
            ]);
        }
    });
});
