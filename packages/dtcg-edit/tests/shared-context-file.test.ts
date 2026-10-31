import { describe, expect, it } from "vitest";
import { create, setExtension, setValue } from "../src/index.js";
import { opened, plainly, resolver } from "./helpers.js";

const tokens = opened({
    "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
        light: [],
        dark: [{ $ref: "./night.json" }],
        dim: [{ $ref: "./dim.json" }, { $ref: "./night.json" }],
    }),
    "base.json": JSON.stringify({
        gap: { $type: "number", $value: 1 },
        space: { $type: "number", $extensions: { "com.example": { steps: 1 } } },
    }),
    "night.json": JSON.stringify({
        gap: { $type: "number", $value: 2 },
        space: { $extensions: { "com.example": { steps: 2 } } },
    }),
    "dim.json": "{}",
});
const dim = { input: { mode: "dim" } };

describe("editing for a context that reads a file another context also lists", () => {
    it("changes the value in the shared file, where this context's value comes from", () => {
        expect(plainly(setValue(tokens, "gap", 3, dim))).toEqual({
            ops: [
                { kind: "set", file: "night.json", jsonPath: ["gap", "$value"], value: 3, was: 2 },
            ],
            alsoAffects: [{ mode: "dark" }],
            moved: [],
        });
    });

    it("changes an extension in the shared file, where this context's extension comes from", () => {
        const result = setExtension(tokens, "space", ["com.example", "steps"], 3, dim);

        expect(plainly(result)).toEqual({
            ops: [
                {
                    kind: "set",
                    file: "night.json",
                    jsonPath: ["space", "$extensions", "com.example", "steps"],
                    value: 3,
                    was: 2,
                },
            ],
            alsoAffects: [{ mode: "dark" }],
            moved: [],
        });
    });

    it("refuses to create a token the shared file already writes for this context", () => {
        expect(create(tokens, "gap", { $value: 3 }, dim)).toEqual({
            refused: { kind: "taken", path: "gap", reason: expect.any(String) },
        });
    });
});
