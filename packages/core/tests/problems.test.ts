import type { Permutations } from "@sugarcube-sh/dtcg";
import type { Reported } from "../src/types/diagnostics.js";
import { describe, expect, it } from "vitest";
import { type Where, problemCount, problemLines, problemsText } from "../src/shared/problems.js";

const where: Where = {
    cwd: "/project",
    entry: "/project/tokens/tokens.resolver.json",
    configFile: "/project/sugarcube.config.ts",
};

function spanAt(file: string, line: number, column: number) {
    return { file, offset: 0, length: 1, start: { line, column }, end: { line, column } };
}

function themes(
    label: string,
    { every = false, count = every ? 2 : 1 }: { every?: boolean; count?: number } = {},
): Permutations {
    const list = Array.from({ length: count }, () => ({}));
    return Object.assign(list, {
        label,
        inputs: [],
        others: every ? [] : [{}],
    }) as unknown as Permutations;
}

function value(message: string, place: ReturnType<typeof spanAt>): Reported {
    return {
        kind: "invalid-value",
        severity: "error",
        message,
        span: place,
        docs: "",
        permutations: themes("everywhere", { every: true }),
        detail: { jsonPath: ["$value"], type: "color", reason: "wrong-shape", value: "" },
    };
}

function missingReference(ref: string, place: ReturnType<typeof spanAt>): Reported {
    return {
        kind: "missing-reference",
        severity: "error",
        message: `\`${ref}\` does not exist`,
        span: place,
        docs: "",
        permutations: themes("everywhere", { every: true }),
        detail: { ref, from: [] },
    };
}

function ignored(place: ReturnType<typeof spanAt>): Reported {
    return {
        kind: "unknown-property",
        severity: "warning",
        message: "`paragraphSpacing` is ignored",
        span: place,
        docs: "",
        permutations: themes("everywhere", { every: true }),
        detail: { property: "paragraphSpacing", type: "typography", jsonPath: [] },
    };
}

const hex = value("`#000` is not a six-digit hex color", spanAt("base.json", 6, 81));
const missing = missingReference("color.inc", spanAt("base.json", 7, 25));
const darkOnly = {
    ...missingReference("color.brnd", spanAt("dark.json", 1, 54)),
    permutations: themes("theme: dark, dim"),
};
const polyfill: Reported = {
    kind: "option-deprecated",
    severity: "warning",
    message: "`polyfill` is deprecated",
    docs: "",
    detail: { option: "polyfill" },
};

describe("problemLines", () => {
    it("writes one line per problem: place, severity, message, kind, in columns", () => {
        expect(problemLines([missing, polyfill], where, { colors: false })).toStrictEqual([
            "tokens/base.json:7:25  error    `color.inc` does not exist  missing-reference",
            "sugarcube.config.ts    warning  `polyfill` is deprecated  option-deprecated",
        ]);
    });

    it("sorts by file, then line and column, with the config's problems last", () => {
        const lines = problemLines([polyfill, darkOnly, missing, hex], where, { colors: false });
        expect(lines.map((line) => line.split(" ")[0])).toStrictEqual([
            "tokens/base.json:6:81",
            "tokens/base.json:7:25",
            "tokens/dark.json:1:54",
            "sugarcube.config.ts",
        ]);
    });

    it("names the permutations by their label when only some have the problem", () => {
        expect(problemLines([darkOnly], where, { colors: false })).toStrictEqual([
            "tokens/dark.json:1:54  error  `color.brnd` does not exist  in theme: dark, dim  missing-reference",
        ]);
    });

    it("names no permutations when every one has the problem, or none does", () => {
        const nowhere = { ...missing, permutations: themes("nowhere", { count: 0 }) };
        expect(problemLines([missing, nowhere], where, { colors: false })).toStrictEqual([
            "tokens/base.json:7:25  error  `color.inc` does not exist  missing-reference",
            "tokens/base.json:7:25  error  `color.inc` does not exist  missing-reference",
        ]);
    });

    it("names no permutations when the problem is in every one read, though not every combination", () => {
        const read = {
            ...missing,
            permutations: themes("density: comfy; mode: light", { every: true }),
        };
        expect(problemLines([read], where, { colors: false })).toStrictEqual([
            "tokens/base.json:7:25  error  `color.inc` does not exist  missing-reference",
        ]);
    });

    it("leaves the place empty for a config problem when there is no config file", () => {
        const flagsOnly = { ...where, configFile: undefined };
        expect(problemLines([missing, polyfill], flagsOnly, { colors: false })).toStrictEqual([
            "tokens/base.json:7:25  error    `color.inc` does not exist  missing-reference",
            "                       warning  `polyfill` is deprecated  option-deprecated",
        ]);
    });

    it("places a file the resolver names from the root where it is, not under the tokens' folder", () => {
        const shared = missingReference("color.nope", spanAt("/shared/brand.json", 3, 12));
        expect(problemLines([shared], where, { colors: false })[0]).toMatch(
            /^\.\.\/shared\/brand\.json:3:12 /,
        );
    });

    it("wraps a long message under its column, never the place", () => {
        const long = value(
            "`{space.sm}` is a reference, which stands for a whole value and cannot be part of one",
            spanAt("base.json", 12, 34),
        );
        expect(problemLines([long], where, { colors: false, width: 74 })).toStrictEqual([
            "tokens/base.json:12:34  error  `{space.sm}` is a reference, which stands",
            "                               for a whole value and cannot be part of one",
            "                               invalid-value",
        ]);
    });

    it("prints each place a problem points to as well, under its message", () => {
        const conflict: Reported = {
            kind: "token-and-group",
            severity: "error",
            message: "this is a token here but a group in another file",
            span: spanAt("dark.json", 3, 12),
            related: [{ message: "declared as a group here", span: spanAt("colors.json", 9, 17) }],
            docs: "",
            permutations: themes("everywhere", { every: true }),
            detail: { reason: "declared", here: "token" },
        };
        expect(problemLines([conflict], where, { colors: false })).toStrictEqual([
            "tokens/dark.json:3:12  error  this is a token here but a group in another file  token-and-group",
            "                              tokens/colors.json:9:17  declared as a group here",
        ]);
    });

    it("prints every problem, however many share a message", () => {
        const many = Array.from({ length: 3 }, (_, index) =>
            ignored(spanAt("type.json", 17 + index, 9)),
        );
        expect(problemLines(many, where, { colors: false })).toHaveLength(3);
    });
});

const counts: [Reported[], string][] = [
    [[hex, missing, polyfill], "2 errors and 1 warning."],
    [[hex], "1 error."],
    [[polyfill, polyfill], "2 warnings."],
];

describe("problemCount", () => {
    it.for(counts)("counts %#: %s", ([problems, counted]) => {
        expect(problemCount(problems)).toBe(counted);
    });
});

describe("problemsText", () => {
    it("is empty when there are no problems", () => {
        expect(problemsText([], where, { colors: false })).toBe("");
    });

    it("is every problem's line, a blank line, then the count", () => {
        expect(problemsText([missing, polyfill], where, { colors: false })).toBe(
            [
                "tokens/base.json:7:25  error    `color.inc` does not exist  missing-reference",
                "sugarcube.config.ts    warning  `polyfill` is deprecated  option-deprecated",
                "",
                "1 error and 1 warning.",
            ].join("\n"),
        );
    });

    it("ends the count with what the host says, when there is an error", () => {
        const ending = "No CSS was written.";
        expect(problemsText([missing], where, { colors: false, ending })).toMatch(
            /\n1 error\. No CSS was written\.$/,
        );
        expect(problemsText([polyfill], where, { colors: false, ending })).toMatch(
            /\n1 warning\.$/,
        );
    });
});
