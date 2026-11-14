import { readFromMemory } from "@sugarcube-sh/dtcg";
import { remove, setValue } from "@sugarcube-sh/dtcg-edit";
import { describe, expect, it } from "vitest";
import { toProblemRows } from "../../src/controllers/views";
import {
    configProblem,
    demoMessage,
    createDemoStudio,
    createSugarcubeAdapterMessage,
    withFile,
} from "./demo-message";

describe("toProblemRows", () => {
    it("gives each problem its file, line and column, severity, message and kind", () => {
        const studio = createDemoStudio(withFile("dark.json", '{ "color": { "text": '));

        const [row] = toProblemRows(studio.state.problems);

        expect(row?.location).toMatch(/^dark\.json:1:\d+$/);
        expect(row?.severity).toBe("error");
        expect(row?.kind).toBe("invalid-json");
    });

    it("names the themes a problem is in, when it isn't in all of them", () => {
        const studio = createDemoStudio(withFile("dark.json", '{ "color": { "text": '));

        expect(toProblemRows(studio.state.problems)[0]?.permutationLabel).toBe("mode: dark");
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
            { inputs: "each-context" },
        );

        const [row] = toProblemRows(read.diagnostics);

        expect(read.diagnostics[0]?.permutations.label).not.toBe("every permutation");
        expect(row?.permutationLabel).toBeUndefined();
    });

    it("gives a problem in no file no place", () => {
        const studio = createDemoStudio(
            demoMessage({ adapter: createSugarcubeAdapterMessage({ problems: [configProblem] }) }),
        );

        const [row] = toProblemRows(studio.state.problems);

        expect(row?.location).toBeUndefined();
        expect(row?.message).toBe("`variables.prefix` must be a string");
        expect(row?.permutationLabel).toBeUndefined();
    });

    it("gives no rows when there are no problems", () => {
        expect(toProblemRows(createDemoStudio().state.problems)).toEqual([]);
    });

    it("names every token a problem is in, in place of a file and line", () => {
        const studio = createDemoStudio();
        studio.do(remove(studio.state.tokens, "color.brand.500"));

        const missing = toProblemRows(studio.state.problems).find(
            ({ kind }) => kind === "missing-reference",
        );

        expect(missing?.paths).toEqual(["color.border.brand", "border.focus"]);
        expect(missing?.location).toBeUndefined();
    });

    it("names every token in a loop the same way, with no rule for each kind", () => {
        const studio = createDemoStudio();
        studio.do(setValue(studio.state.tokens, "color.text.muted", "{color.text.subtle}"));
        studio.do(setValue(studio.state.tokens, "color.text.subtle", "{color.text.muted}"));

        const loop = toProblemRows(studio.state.problems).find(
            ({ kind }) => kind === "circular-reference",
        );

        expect([...(loop?.paths ?? [])].sort()).toEqual(["color.text.muted", "color.text.subtle"]);
        expect(loop?.location).toBeUndefined();
    });

    it("gives a problem in no token its file, line and column, and no tokens", () => {
        const studio = createDemoStudio(withFile("dark.json", '{ "color": { "text": '));

        const [row] = toProblemRows(studio.state.problems);

        expect(row?.location).toBeDefined();
        expect(row?.paths).toBeUndefined();
    });
});
