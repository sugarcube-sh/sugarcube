import { describe, expect, it } from "vitest";
import { oneFile } from "../token-files.js";
import { similarName } from "../../src/read/similar.js";

const close: [string, string[], string][] = [
    ["color.brnd", ["color.brand", "color.ink"], "color.brand"],
    ["color.brnad", ["color.brand", "color.ink"], "color.brand"],
    ["color.inc", ["color.ink", "color.line"], "color.ink"],
    ["colr.brand", ["color.brand", "space.sm"], "color.brand"],
    ["colour", ["color", "dimension"], "color"],
    ["defualt", ["contexts", "default", "description"], "default"],
];

const far: [string, string[]][] = [
    ["color.ink", ["color.text", "color.line"]],
    ["color.gone", ["color.line", "color.tone", "color.bone"]],
    ["banana", ["color", "dimension"]],
];

describe("similarName", () => {
    it.for(close)("finds %s close to %j: %s", ([wanted, candidates, found]) => {
        expect(similarName(wanted, candidates)).toBe(found);
    });

    it.for(far)("finds nothing close to %s among %j", ([wanted, candidates]) => {
        expect(similarName(wanted, candidates)).toBeUndefined();
    });
});

describe("a missing reference's similar name", () => {
    it("is never the token that holds the reference", () => {
        const json = {
            color: {
                $type: "color",
                line: { $value: "{color.lin}" },
            },
        };
        const tokens = oneFile(json);
        const [found] = tokens.diagnostics;
        expect(found?.kind).toBe("missing-reference");
        expect(found?.detail).not.toHaveProperty("suggestion");
    });

    const pointingAt = ($ref: string, $type = "color") => {
        const json = {
            color: {
                $type: "color",
                ink: { $value: { colorSpace: "srgb", components: [0, 0, 0] } },
            },
            uses: { $type, $value: { $ref } },
        };
        const tokens = oneFile(json);
        return tokens.diagnostics.map(({ kind, detail }) => ({ kind, detail }));
    };

    it.for<[string, string, string, string?]>([
        [
            "is written as a pointer when the reference is one: #/color/ink/$value",
            "#/color/inc/$value",
            "color",
            "#/color/ink/$value",
        ],
        [
            "is written as a pointer when the reference is one: #/color/ink",
            "#/color/inc",
            "color",
            "#/color/ink",
        ],
        [
            "keeps a pointer's steps into the value",
            "#/color/inc/$value/components/0",
            "number",
            "#/color/ink/$value/components/0",
        ],
        [
            "is not given when the token a pointer names exists and the step inside it does not",
            "#/color/ink/$value/components/9",
            "number",
        ],
    ])("%s", ([, $ref, $type, suggestion]) => {
        expect(pointingAt($ref, $type)).toStrictEqual([
            {
                kind: "missing-reference",
                detail: { ref: $ref, from: ["uses"], ...(suggestion && { suggestion }) },
            },
        ]);
    });
});
