import { readFromMemory } from "@sugarcube-sh/dtcg";
import { remove, setValue } from "@sugarcube-sh/dtcg-edit";
import { describe, expect, it } from "vitest";
import { problemRows } from "../../src/controllers/views";
import { configProblem, demoMessage, studioOn, sugarcubeSent, withFile } from "./demo-message";

describe("problemRows", () => {
    it("gives each problem its file, line and column, severity, message and kind", () => {
        const studio = studioOn(withFile("dark.json", '{ "color": { "text": '));

        const [row] = problemRows(studio.state.problems);

        expect(row?.place).toMatch(/^dark\.json:1:\d+$/);
        expect(row?.severity).toBe("error");
        expect(row?.kind).toBe("invalid-json");
    });

    it("names the themes a problem is in, when it isn't in all of them", () => {
        const studio = studioOn(withFile("dark.json", '{ "color": { "text": '));

        expect(problemRows(studio.state.problems)[0]?.inPermutations).toBe("mode: dark");
    });

    it("names no themes for a problem in every permutation read, though the read built only some", () => {
        const read = readFromMemory(
            {
                files: {
                    "tokens.resolver.json": JSON.stringify({
                        version: "2025.10",
                        resolutionOrder: [
                            { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                            {
                                type: "modifier",
                                name: "mode",
                                default: "light",
                                contexts: { light: [], dark: [] },
                            },
                            {
                                type: "modifier",
                                name: "density",
                                default: "comfy",
                                contexts: { comfy: [], compact: [] },
                            },
                        ],
                    }),
                    "base.json": '{ "gap": ',
                },
            },
            { permutations: "each-context" },
        );

        const [row] = problemRows(read.diagnostics);

        expect(read.diagnostics[0]?.permutations.label).not.toBe("everywhere");
        expect(row?.inPermutations).toBeUndefined();
    });

    it("gives a problem in no file no place", () => {
        const studio = studioOn(
            demoMessage({ adapter: sugarcubeSent({ problems: [configProblem] }) }),
        );

        const [row] = problemRows(studio.state.problems);

        expect(row?.place).toBeUndefined();
        expect(row?.message).toBe("`variables.prefix` must be a string");
        expect(row?.inPermutations).toBeUndefined();
    });

    it("gives no rows when there are no problems", () => {
        expect(problemRows(studioOn().state.problems)).toEqual([]);
    });

    it("names every token a problem is in, in place of a file and line", () => {
        const studio = studioOn();
        studio.do(remove(studio.state.tokens, "color.brand.500"));

        const missing = problemRows(studio.state.problems).find(
            ({ kind }) => kind === "missing-reference",
        );

        expect(missing?.paths).toEqual(["color.border.brand", "border.focus"]);
        expect(missing?.place).toBeUndefined();
    });

    it("names every token in a loop the same way, with no rule for each kind", () => {
        const studio = studioOn();
        studio.do(setValue(studio.state.tokens, "color.text.muted", "{color.text.subtle}"));
        studio.do(setValue(studio.state.tokens, "color.text.subtle", "{color.text.muted}"));

        const loop = problemRows(studio.state.problems).find(
            ({ kind }) => kind === "circular-reference",
        );

        expect([...(loop?.paths ?? [])].sort()).toEqual(["color.text.muted", "color.text.subtle"]);
        expect(loop?.place).toBeUndefined();
    });

    it("gives a problem in no token its file, line and column, and no tokens", () => {
        const studio = studioOn(withFile("dark.json", '{ "color": { "text": '));

        const [row] = problemRows(studio.state.problems);

        expect(row?.place).toBeDefined();
        expect(row?.paths).toBeUndefined();
    });
});
