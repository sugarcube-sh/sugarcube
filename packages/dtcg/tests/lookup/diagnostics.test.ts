import { describe, expect, it } from "vitest";
import { type Permutation, readFromMemory } from "../../src/index.js";
import { getDiagnosticsAt } from "../../src/editor.js";
import { oneFile } from "../token-files.js";

const resolver = {
    version: "2025.10",
    sets: { base: { sources: [{ $ref: "base.json" }] } },
    modifiers: {
        mode: { contexts: { light: [], dark: [{ $ref: "dark.json" }] }, default: "light" },
    },
    resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/mode" }],
};

const base = JSON.stringify({
    color: {
        $type: "color",
        ok: { $value: "#ffffff" },
        bad: { $value: "nope" },
        a: { $value: "{color.missing}" },
        b: { $value: "{color.missing}" },
    },
    loop: { $type: "number", x: { $value: "{loop.y}" }, y: { $value: "{loop.x}" } },
    space: { $type: "dimension", sm: { $value: { value: 4, unit: "px" } } },
});

const dark = JSON.stringify({
    color: { ok: { $value: "wrong" } },
    space: { $type: "dimension", $value: { value: 8, unit: "px" } },
});

const files = {
    "tokens.resolver.json": JSON.stringify(resolver),
    "base.json": base,
    "dark.json": dark,
};
const tokens = readFromMemory({ files }, { hexStringColors: true });
const light = tokens.getPermutation();
const darkMode = tokens.getPermutation({ mode: "dark" });

const kinds = (path: string) => tokens.getDiagnostics(path).map(({ kind }) => kind);

describe("tokens.getDiagnostics", () => {
    it("gives a token's own problems", () => {
        expect(kinds("color.bad")).toStrictEqual(["invalid-value"]);
    });

    it("gives a missing reference to every token that uses it, though it is reported once", () => {
        expect(kinds("color.a")).toStrictEqual(["missing-reference"]);
        expect(kinds("color.b")).toStrictEqual(["missing-reference"]);
        expect(tokens.diagnostics.filter(({ kind }) => kind === "missing-reference")).toHaveLength(
            1,
        );
    });

    it("gives a reference loop to every token in it", () => {
        expect(kinds("loop.x")).toStrictEqual(["circular-reference"]);
        expect(kinds("loop.y")).toStrictEqual(["circular-reference"]);
    });

    it("gives a group its own problems", () => {
        expect(kinds("space")).toStrictEqual(["token-and-group"]);
    });

    it("gives each problem with the permutations it is in", () => {
        const [problem] = tokens.getDiagnostics("color.ok");
        expect(problem?.kind).toBe("invalid-value");
        expect(problem?.permutations?.label).toBe("mode: dark");
    });

    it("gives a token or group with no problems of its own none", () => {
        expect(kinds("space.sm")).toStrictEqual([]);
        expect(kinds("loop")).toStrictEqual([]);
    });

    it("gives no token a file's problem", () => {
        const broken = readFromMemory({ files: { "tokens.json": '{ "a": ' } });
        expect(broken.diagnostics.length).toBeGreaterThan(0);
        expect(broken.getDiagnostics("a")).toStrictEqual([]);
    });
});

describe("permutation.getDiagnostics", () => {
    const inPermutation = (permutation: Permutation, path: string) =>
        permutation.getDiagnostics(path).map(({ kind }) => kind);

    it("gives the problems about the path in this permutation", () => {
        expect(inPermutation(darkMode, "color.ok")).toStrictEqual(["invalid-value"]);
        expect(light.getDiagnostics("color.ok")).toStrictEqual([]);
    });

    it("gives a problem in a value every permutation reads to each of them", () => {
        expect(tokens.getDiagnostics("color.bad")[0]?.permutations.label).toBe("everywhere");
        expect(inPermutation(darkMode, "color.bad")).toStrictEqual(["invalid-value"]);
        expect(inPermutation(light, "color.bad")).toStrictEqual(["invalid-value"]);
    });

    it("gives the problems every permutation shares too", () => {
        expect(inPermutation(light, "color.a")).toStrictEqual(["missing-reference"]);
        expect(inPermutation(darkMode, "loop.x")).toStrictEqual(["circular-reference"]);
    });
});

describe("a problem in a file only some permutations read", () => {
    const walked = readFromMemory({
        files: {
            ...files,
            "dark.json": JSON.stringify({ gap: { $type: "number", $value: 2, $unknwn: 1 } }),
            "base.json": JSON.stringify({ gap: { $type: "number", $value: 1 } }),
        },
    });

    it("is not given to the token in a permutation that does not read it", () => {
        expect(walked.getPermutation().getDiagnostics("gap")).toStrictEqual([]);
    });

    it("names every permutation for a problem in the resolver, which every permutation is built from", () => {
        const resolverProblem = readFromMemory({
            files: { ...files, "tokens.resolver.json": JSON.stringify({ ...resolver, extra: 1 }) },
        }).diagnostics.find(({ span }) => span?.file === "tokens.resolver.json");
        expect(resolverProblem).toBeDefined();
        expect(resolverProblem?.permutations.label).toBe("everywhere");
    });

    it("names none for a problem in a file no permutation the read built reads", () => {
        const lightOnly = readFromMemory(
            { files: { ...files, "dark.json": '{ "color": ' } },
            { inputs: [{}] },
        );
        const broken = lightOnly.diagnostics.find(({ span }) => span?.file === "dark.json");
        expect(broken).toBeDefined();
        expect(broken?.permutations.label).toBe("nowhere");
        expect([...(broken?.permutations ?? [])]).toStrictEqual([]);
    });

    it("names every permutation the read built for a problem in no file", () => {
        const read = readFromMemory({ files }, { inputs: [{}, { shade: "deep" }] });
        const unknown = read.diagnostics.find(({ span }) => span === undefined);
        expect(unknown).toBeDefined();
        expect([...(unknown?.permutations ?? [])]).toStrictEqual([...read.permutations]);
        expect(unknown?.permutations.label).toBe("mode: light");
    });
});

describe("a problem in a value a token inherits", () => {
    const extended = oneFile({
        button: {
            $type: "number",
            base: { pad: { $value: "wide" } },
            primary: { $extends: "{button.base}" },
        },
    });

    it("is reported once, about the token that writes the value", () => {
        expect(extended.diagnostics.map(({ kind, path }) => [kind, path])).toStrictEqual([
            ["invalid-value", "button.base.pad"],
        ]);
    });

    it("is given to the token that inherits the value too", () => {
        const [problem] = extended.diagnostics;
        expect(extended.getPermutation().getDiagnostics("button.primary.pad")).toStrictEqual([
            problem,
        ]);
        expect(extended.getDiagnostics("button.primary.pad")).toStrictEqual([problem]);
    });
});

describe("getDiagnosticsAt", () => {
    const bad = tokens.getDiagnostics("color.bad")[0];
    const at = bad?.span;

    it("gives the problems written at a place", () => {
        if (!at) throw new Error("the problem has a place");
        expect(getDiagnosticsAt(tokens, at)).toStrictEqual([bad]);
    });

    it("gives the problems a place overlaps, a point inside one included", () => {
        if (!at) throw new Error("the problem has a place");
        expect(
            getDiagnosticsAt(tokens, { file: at.file, offset: at.offset + 1, length: 0 }),
        ).toStrictEqual([bad]);
        expect(
            getDiagnosticsAt(tokens, { file: at.file, offset: at.offset - 2, length: 3 }).map(
                ({ kind }) => kind,
            ),
        ).toContain("invalid-value");
    });

    it("gives none for a place in another file, or where nothing is wrong", () => {
        if (!at) throw new Error("the problem has a place");
        expect(
            getDiagnosticsAt(tokens, { file: "dark.json", offset: at.offset, length: 1 }),
        ).not.toContain(bad);
        expect(getDiagnosticsAt(tokens, { file: "base.json", offset: 0, length: 1 })).toStrictEqual(
            [],
        );
    });
});

describe("a missing reference's problem", () => {
    it("names the tokens it is written in as `from`", () => {
        const missing = tokens.diagnostics.find(({ kind }) => kind === "missing-reference");
        expect(missing?.kind === "missing-reference" && missing.detail).toMatchObject({
            ref: "color.missing",
            from: ["color.a", "color.b"],
        });
    });
});
