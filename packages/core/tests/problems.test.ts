import { readFromMemory } from "@sugarcube-sh/dtcg";
import type { AnyDiagnostic } from "../src/types/diagnostics.js";
import { describe, expect, it } from "vitest";
import {
    type ProblemContext,
    formatProblemBlocks,
    formatProblemCount,
    formatProblems,
} from "../src/shared/problems.js";

const base = `{
  "space": {
    "$type": "dimension",
    "sm": { "$value": "0.25rem" },
    "md": { "$value": "{space.sn}" }
  },
  "color": {
    "$type": "color",
    "link": { "$value": "{color.brand}" }
  }
}`;

const tokens = readFromMemory({
    files: {
        "tokens.resolver.json": JSON.stringify({
            version: "2025.10",
            resolutionOrder: [
                { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                {
                    type: "modifier",
                    name: "mode",
                    default: "light",
                    contexts: { light: [{ $ref: "light.json" }], dark: [{ $ref: "dark.json" }] },
                },
            ],
        }),
        "base.json": base,
        "light.json": JSON.stringify({
            color: { brand: { $value: { colorSpace: "srgb", components: [0, 0, 1] } } },
        }),
        "dark.json": JSON.stringify({ color: { muted: { $value: "{color.brnd}" } } }),
    },
});

const where: ProblemContext = {
    cwd: "/project",
    entryFile: "/project/tokens/tokens.resolver.json",
    configFile: "/project/sugarcube.config.ts",
    tokens,
};

function writing(ref: string): AnyDiagnostic {
    const problem = tokens.diagnostics.find(({ detail }) => "ref" in detail && detail.ref === ref);
    if (!problem) throw new Error(`no problem with ${ref}`);
    return problem;
}

const asString = tokens.diagnostics.find(({ kind }) => kind === "invalid-value")!;
const typo = writing("space.sn");
const darkOnly = writing("color.brand");
const inDarkFile = writing("color.brnd");

const polyfill: AnyDiagnostic = {
    kind: "option-deprecated",
    severity: "warning",
    message: "`polyfill` is deprecated",
    docsUrl: "",
    detail: { option: "polyfill" },
};

const look = { colors: false };

describe("formatProblemBlocks", () => {
    it("writes the place and kind, the message, then the problem's line with its fix at the marker", () => {
        expect(formatProblemBlocks([asString], where, look).map(({ text }) => text)).toStrictEqual([
            [
                "tokens/base.json:4:23  error[invalid-value]",
                "  a dimension can't be a string",
                '  4 |     "sm": { "$value": "0.25rem" },',
                '    |                       ^^^^^^^^^ write `{ "value": 0.25, "unit": "rem" }`',
            ].join("\n"),
        ]);
    });

    it("leaves the marker alone when there's no fix", () => {
        const [{ text: block } = { text: "" }] = formatProblemBlocks([inDarkFile], where, look);
        expect(block?.split("\n").at(-1)?.endsWith("^")).toBe(true);
    });

    it("names the permutations when the file doesn't already say them", () => {
        expect(formatProblemBlocks([darkOnly], where, look)[0]?.text.split("\n")[1]).toBe(
            "  `color.brand` does not exist in mode: dark",
        );
    });

    it("names no permutations when only they read the file", () => {
        expect(formatProblemBlocks([inDarkFile], where, look)[0]?.text.split("\n")[1]).toBe(
            "  `color.brnd` does not exist",
        );
    });

    it("names no permutations when every one has the problem", () => {
        expect(formatProblemBlocks([typo], where, look)[0]?.text.split("\n")[1]).toBe(
            "  `space.sn` does not exist",
        );
    });

    it("sorts by file, then line and column, with the config's problems last", () => {
        const blocks = formatProblemBlocks(
            [polyfill, inDarkFile, darkOnly, typo, asString],
            where,
            look,
        );
        expect(blocks.map(({ text }) => text.split("  ")[0])).toStrictEqual([
            "tokens/base.json:4:23",
            "tokens/base.json:5:23",
            "tokens/base.json:9:25",
            "tokens/dark.json:1:29",
            "sugarcube.config.ts",
        ]);
    });

    it("writes a problem with no place in a file as its first two lines, then its fix", () => {
        const helped = { ...polyfill, help: "use `native`" };
        expect(formatProblemBlocks([helped], where, look).map(({ text }) => text)).toStrictEqual([
            [
                "sugarcube.config.ts  warning[option-deprecated]",
                "  `polyfill` is deprecated",
                "  help: use `native`",
            ].join("\n"),
        ]);
    });

    it("leaves the place out for a config problem when there is no config file", () => {
        const flagsOnly = { ...where, configFile: undefined };
        expect(formatProblemBlocks([polyfill], flagsOnly, look)[0]?.text.split("\n")[0]).toBe(
            "warning[option-deprecated]",
        );
    });

    it("moves the fix under the marker when it doesn't fit beside it", () => {
        const lines = formatProblemBlocks([asString], where, { ...look, width: 60 })[0]?.text.split(
            "\n",
        );
        expect(lines?.slice(3)).toStrictEqual([
            "    |                       ^^^^^^^^^",
            '    |                       write `{ "value": 0.25, "unit": "rem" }`',
        ]);
    });

    it("shows the part of a long line around the problem", () => {
        const long = readFromMemory({
            files: {
                "tokens.json": JSON.stringify({
                    a: { $type: "number", $value: 1, $description: "x".repeat(200) },
                    b: { $type: "number", $value: "{a.c}" },
                }),
            },
        });
        const [{ text: block } = { text: "" }] = formatProblemBlocks(
            long.diagnostics,
            { ...where, tokens: long },
            look,
        );
        const [, , text, marker] = block?.split("\n") ?? [];
        expect(text).toMatch(/^ {2}1 \| …x+"\},"b":\{"\$type":"number","\$value":"\{a\.c\}"\}\}$/);
        expect(text?.length).toBeLessThanOrEqual(100);
        expect(text?.indexOf('"{a.c}"')).toBe(marker?.indexOf("^"));
    });

    it("writes the fix on its own line when there are no tokens to read the file from", () => {
        const [{ text: block } = { text: "" }] = formatProblemBlocks(
            [asString],
            { ...where, tokens: undefined },
            look,
        );
        expect(block?.split("\n").slice(2)).toStrictEqual([
            '  help: write `{ "value": 0.25, "unit": "rem" }`',
        ]);
    });

    it("prints each place a problem points to as well, under it", () => {
        const conflict: AnyDiagnostic = {
            ...asString,
            relatedInformation: [
                {
                    message: "declared as a group here",
                    span: { ...asString.span!, file: "dark.json" },
                },
            ],
        };
        expect(formatProblemBlocks([conflict], where, look)[0]?.text.split("\n").at(-1)).toBe(
            "  tokens/dark.json:4:23  declared as a group here",
        );
    });

    it("places a file the resolver names from the root where it is, not under the tokens' folder", () => {
        const shared = { ...typo, span: { ...typo.span!, file: "/shared/brand.json" } };
        expect(formatProblemBlocks([shared], where, look)[0]?.text).toMatch(
            /^\.\.\/shared\/brand\.json:5:23 /,
        );
    });

    it("colors the severity, the place and the marker, and greys the kind", () => {
        const [first, , , marker] = formatProblemBlocks([asString], where, {
            colors: true,
        })[0]!.text.split("\n");
        expect(first).toBe(
            "\u001b[36mtokens/base.json\u001b[39m\u001b[33m:4:23\u001b[39m  \u001b[31merror\u001b[39m\u001b[90m[invalid-value]\u001b[39m",
        );
        expect(marker).toContain("\u001b[31m^^^^^^^^^\u001b[39m");
    });
});

const counts: [AnyDiagnostic[], string][] = [
    [[asString, typo, polyfill], "2 errors and 1 warning."],
    [[asString], "1 error."],
    [[polyfill, polyfill], "2 warnings."],
];

describe("formatProblemCount", () => {
    it.for(counts)("counts %#: %s", ([problems, counted]) => {
        expect(formatProblemCount(problems)).toBe(counted);
    });
});

describe("formatProblems", () => {
    it("is empty when there are no problems", () => {
        expect(formatProblems([], where, look)).toBe("");
    });

    it("is every problem, a blank line apart, then the count", () => {
        const [first, second] = formatProblemBlocks([typo, polyfill], where, look).map(
            ({ text }) => text,
        );
        expect(formatProblems([typo, polyfill], where, look)).toBe(
            `${first}\n\n${second}\n\n1 error and 1 warning.`,
        );
    });

    it("ends the count with what the host says, when there is an error", () => {
        const ending = "No CSS was written.";
        expect(formatProblems([typo], where, { ...look, failureText: ending })).toMatch(
            /\n1 error\. No CSS was written\.$/,
        );
        expect(formatProblems([polyfill], where, { ...look, failureText: ending })).toMatch(
            /\n1 warning\.$/,
        );
    });
});
