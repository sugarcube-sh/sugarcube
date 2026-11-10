import { describe, expect, it } from "vitest";
import { defineGenerator, readFromMemory } from "../../src/index.js";
import { oneFile, oneSet } from "../token-files.js";

function onlyProblem(json: unknown) {
    const [problem, ...rest] = oneFile(json).diagnostics;
    expect(rest).toStrictEqual([]);
    return problem;
}

describe("a problem's help, from a read", () => {
    it("gives a fix where there's a clear one", () => {
        const problem = onlyProblem({ size: { $type: "dimension", $value: "16px" } });
        expect(problem?.message).toBe("a dimension can't be a string");
        expect(problem?.help).toBe('write `{ "value": 16, "unit": "px" }`');
    });

    it("has no help where there's no clear fix", () => {
        const problem = onlyProblem({ size: { $type: "dimension", $value: "{size.gone}" } });
        expect(problem).not.toHaveProperty("help");
    });

    it("tells a value set beside $value from tokens nested in a token", () => {
        const value = onlyProblem({ ink: { $type: "number", $value: 1, alpha: 0 } });
        const nested = onlyProblem({
            ink: { $type: "number", $value: 1, light: { $value: 2 } },
        });
        expect(value?.detail).toStrictEqual({ reason: "child", child: "alpha", found: "number" });
        expect(value?.message).toBe("`alpha` is not a token property");
        expect(nested?.detail).toStrictEqual({ reason: "child", child: "light", found: "object" });
        expect(nested?.message).toBe("a token can't contain other tokens");
    });

    it("names the unit in a string with one the type can't have", () => {
        const problem = onlyProblem({ size: { $type: "dimension", $value: "2em" } });
        expect(problem?.detail).toMatchObject({ unit: "em", allowed: ["px", "rem"] });
        expect(problem?.message).toBe("`em` is not a dimension unit");
    });
});

describe("a token in one file and a group in another", () => {
    const tokens = readFromMemory({
        files: {
            "tokens.resolver.json": oneSet("base.json", "dark.json"),
            "base.json": JSON.stringify({ color: { ink: { $type: "number", $value: 1 } } }),
            "dark.json": JSON.stringify({ color: { ink: { quiet: { $value: 2 } } } }),
        },
    });
    const problem = tokens.diagnostics.find(({ kind }) => kind === "token-and-group");

    it("names the token and the other file", () => {
        expect(problem?.detail).toStrictEqual({
            reason: "declared",
            here: "group",
            path: "color.ink",
            otherFiles: ["base.json"],
        });
        expect(problem?.message).toBe("`color.ink` is a token in `base.json`");
    });

    it("points at the name, in both places", () => {
        expect(problem?.span).toMatchObject({ file: "dark.json", length: '"ink"'.length });
        expect(problem?.relatedInformation?.[0]?.span).toMatchObject({
            file: "base.json",
            length: '"ink"'.length,
        });
    });
});

describe("an extension's problem with a whole object", () => {
    const steps = defineGenerator({
        extension: ["com.example", "steps"],
        messages: { "needs-count": () => "`steps` needs a count" },
        generate: () => ({ ok: false, errors: [{ jsonPath: [], reason: "needs-count" }] }),
    });
    const tokens = oneFile(
        { space: { $type: "dimension", $extensions: { "com.example": { steps: { min: 1 } } } } },
        { generators: [steps] },
    );

    it("points at its name, not the whole object", () => {
        const [problem] = tokens.diagnostics;
        expect(problem?.kind).toBe("extension-invalid");
        expect(problem?.span?.length).toBe('"steps"'.length);
    });
});
