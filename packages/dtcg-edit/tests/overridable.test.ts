import { describe, expect, it } from "vitest";
import { overridable, setValue } from "../src/index.js";
import { committed, demo, opened, resolver } from "./helpers.js";

describe("overridable", () => {
    it("lists each context a token can be given its own value for, with its input and label", () => {
        expect(overridable(demo, "color.brand.500")).toEqual([
            { input: { mode: "dark" }, label: "mode: dark" },
        ]);
    });

    it("leaves out a context that already writes the token, and a modifier's default", () => {
        expect(overridable(demo, "color.text.default")).toEqual([]);
    });

    it("gives the input setValue writes the override with", () => {
        const [dark] = overridable(demo, "color.brand.500");
        const after = committed(
            demo,
            setValue(demo, "color.brand.500", "{color.brand.400}", { input: dark!.input }),
        );

        expect(
            after.getPermutation({ mode: "dark" }).getToken("color.brand.500")?.winningDefinition
                .source.file,
        ).toBe("dark.json");
        expect(overridable(after, "color.brand.500")).toEqual([]);
    });

    it("leaves out a context with no file of its own to hold the override", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], { light: [], dark: [] }),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
        };

        expect(overridable(opened(files), "bg")).toEqual([]);
    });

    it("leaves out a context whose override a later file would hide", () => {
        const files = {
            "tokens.resolver.json": JSON.stringify({
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "./base.json" }] },
                    {
                        type: "modifier",
                        name: "mode",
                        default: "light",
                        contexts: { light: [], dark: [{ $ref: "./dark.json" }] },
                    },
                    {
                        type: "modifier",
                        name: "brand",
                        default: "a",
                        contexts: { a: [{ $ref: "./a.json" }], b: [] },
                    },
                ],
            }),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
            "dark.json": "{}",
            "a.json": '{ "bg": { "$type": "color", "$value": "#eeeeee" } }',
        };
        const tokens = opened(files);

        expect(setValue(tokens, "bg", "#000000", { input: { mode: "dark" } }).refused?.kind).toBe(
            "hidden-by-later-file",
        );
        expect(overridable(tokens, "bg")).toEqual([]);
    });

    it("lists nothing for a path with no token", () => {
        expect(overridable(demo, "color.nothing")).toEqual([]);
    });
});
