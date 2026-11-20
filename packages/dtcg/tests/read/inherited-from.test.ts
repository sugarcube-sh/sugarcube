import { describe, expect, it } from "vitest";
import { lightDark, oneFile } from "../token-files.js";
import { readFromMemory } from "../../src/index.js";

const tokens = oneFile({
    color: {
        $type: "color",
        blue: { $value: { colorSpace: "srgb", components: [0.1, 0.4, 0.8] } },
        primary: { $value: "{color.blue}", $description: "Links and buttons" },
    },
    brand: { $value: "{color.primary}" },
    button: {
        $type: "dimension",
        $description: "Every button",
        $deprecated: "Use action",
        padding: { $value: { value: 8, unit: "px" } },
        sizes: { small: { $value: { value: 4, unit: "px" } } },
    },
    cta: { $extends: "{button}", gap: { $value: { value: 4, unit: "px" } } },
    hero: { $extends: "{cta}" },
    old: { $deprecated: true, inner: { $type: "number", n: { $value: 1 } } },
});
const light = tokens.getPermutation();
const token = (path: string) => light.getToken(path)!;
const group = (path: string) => light.getGroup(path)!;

describe("where a token's type comes from (Format 6.7.3)", () => {
    it("is absent when the token writes $type", () => {
        expect(oneFile({ n: { $type: "number", $value: 1 } }).getToken("n")?.typeFrom).toBe(
            undefined,
        );
    });

    it("is the group that writes $type, from a group it's inside", () => {
        expect(token("color.blue").typeFrom).toStrictEqual({ path: "color", via: "group" });
    });

    it("is the token its value refers to, when it writes no $type", () => {
        expect(token("brand").typeFrom).toStrictEqual({ path: "color.primary", via: "reference" });
    });

    it("is the group that writes $type, through the $extends of the group it's inside", () => {
        expect(token("cta.gap").typeFrom).toStrictEqual({ path: "button", via: "group" });
    });

    it("names the top of the file as the empty path", () => {
        expect(
            oneFile({ $type: "number", n: { $value: 1 } }).getToken("n")?.typeFrom,
        ).toStrictEqual({ path: "", via: "group" });
    });
});

describe("where a group's type, description and deprecation come from", () => {
    it("are absent when the group writes them", () => {
        const { typeFrom, descriptionFrom, deprecatedFrom } = group("button");
        expect([typeFrom, descriptionFrom, deprecatedFrom]).toStrictEqual([
            undefined,
            undefined,
            undefined,
        ]);
    });

    it("are the group that writes them, through $extends", () => {
        const extended = { path: "button", via: "extends" };
        const { typeFrom, descriptionFrom, deprecatedFrom } = group("cta");
        expect([typeFrom, descriptionFrom, deprecatedFrom]).toStrictEqual([
            extended,
            extended,
            extended,
        ]);
    });

    it("name the group that writes them at the end of an $extends chain", () => {
        expect(group("hero").descriptionFrom).toStrictEqual({ path: "button", via: "extends" });
        expect(group("hero").typeFrom).toStrictEqual({ path: "button", via: "extends" });
    });

    it("are a group it's inside, for type and deprecation", () => {
        expect(group("old.inner").deprecatedFrom).toStrictEqual({ path: "old", via: "group" });
        expect(group("color").typeFrom).toBe(undefined);
        expect(group("button.sizes").typeFrom).toStrictEqual({ path: "button", via: "group" });
    });

    it("never takes a description from a group it's inside", () => {
        expect(group("button.sizes").descriptionFrom).toBe(undefined);
        expect(group("button.sizes").description).toBe(undefined);
    });
});

describe("where a token's deprecation comes from", () => {
    it("is the group that writes $deprecated, reached through a group it's inside", () => {
        expect(token("button.padding").deprecatedFrom).toStrictEqual({
            path: "button",
            via: "group",
        });
        expect(token("cta.gap").deprecatedFrom).toStrictEqual({ path: "button", via: "group" });
    });

    it("is absent when the token writes $deprecated, or a closer group undoes it", () => {
        const read = oneFile({
            $type: "number",
            old: {
                $deprecated: true,
                own: { $deprecated: "Use new", $value: 1 },
                kept: { $deprecated: false, n: { $value: 1 } },
            },
        });
        expect(read.getToken("old.own")?.deprecatedFrom).toBe(undefined);
        expect(read.getToken("old.kept.n")?.deprecatedFrom).toBe(undefined);
    });
});

describe("a copy through $extends", () => {
    it("names the token or group it's a copy of, where it's written", () => {
        expect(token("cta.padding").extendedFrom).toStrictEqual({ path: "button.padding" });
        expect(group("cta.sizes").extendedFrom).toStrictEqual({ path: "button.sizes" });
    });

    it("names where it's written when it's a copy of a copy", () => {
        expect(token("hero.padding").extendedFrom).toStrictEqual({ path: "button.padding" });
        expect(token("hero.gap").extendedFrom).toStrictEqual({ path: "cta.gap" });
        expect(group("hero.sizes").extendedFrom).toStrictEqual({ path: "button.sizes" });
    });

    it("is absent on what a group writes itself", () => {
        expect(token("cta.gap").extendedFrom).toBe(undefined);
        expect(group("cta").extendedFrom).toBe(undefined);
    });
});

describe("what a definition writes, without the $", () => {
    it("is a token's value as written, and the properties it writes itself", () => {
        expect(token("color.primary").winningDefinition.local).toStrictEqual({
            value: "{color.blue}",
            description: "Links and buttons",
        });
    });

    it("is the later file's, since a later file replaces a token whole (Resolver 6.2)", () => {
        const read = readFromMemory({
            files: {
                "tokens.resolver.json": lightDark(["base.json"], ["dark.json"]),
                "base.json": JSON.stringify({
                    n: { $type: "number", $description: "One", $value: 1 },
                }),
                "dark.json": JSON.stringify({ n: { $type: "number", $value: 2 } }),
            },
        });
        expect(
            read.getPermutation({ mode: "dark" }).getToken("n")?.winningDefinition.local,
        ).toStrictEqual({ value: 2, type: "number" });
    });

    it("keeps $deprecated: false, and leaves out a $type the spec doesn't define", () => {
        const read = oneFile({ g: { $deprecated: false, $type: "colour", n: { $value: 1 } } });
        expect(read.getGroup("g")?.definitions[0]?.local).toStrictEqual({ deprecated: false });
    });

    it("is the same on the definitions getDefinitions gives", () => {
        const [definition] = tokens.getDefinitions("color.primary");
        expect(definition?.local).toBe(token("color.primary").winningDefinition.local);
    });
});

describe("what a group writes itself, without the $", () => {
    it("names the group its $extends names", () => {
        expect(group("cta").local).toStrictEqual({ extends: "button" });
    });

    it("combines what each file writes on the group, the later file winning", () => {
        const read = readFromMemory({
            files: {
                "tokens.resolver.json": lightDark(["a.json", "b.json"], []),
                "a.json": JSON.stringify({ g: { $type: "number", $description: "A" } }),
                "b.json": JSON.stringify({ g: { $description: "B", n: { $value: 1 } } }),
            },
        });
        expect(read.getPermutation({ mode: "light" }).getGroup("g")?.local).toStrictEqual({
            type: "number",
            description: "B",
        });
    });

    it("is absent when the group writes none of its properties", () => {
        expect(group("cta.sizes").local).toBe(undefined);
    });
});
