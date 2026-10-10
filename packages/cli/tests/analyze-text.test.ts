import { readFromMemory, token } from "@sugarcube-sh/dtcg";
import { beforeAll, describe, expect, it } from "vitest";
import type { Dependent, Impact } from "../src/analyze/answers.js";
import {
    impactHeading,
    impactLines,
    impactSummary,
    unusedLines,
    unusedSummary,
} from "../src/analyze/text.js";
import type { Use } from "../src/analyze/uses.js";
import { strip } from "../src/prompts/common.js";

beforeAll(() => {
    process.stdout.columns = 100;
});

const use = (file: string, path = "x"): Use => ({ token: path, var: "--x", line: 1, file });

const answerFor = (dependents: Dependent[], uses: Use[] = [], path = "target"): Impact =>
    ({ token: { path }, dependents, uses }) as unknown as Impact;

const body = (lines: string[]) => lines.slice(2).map(strip);

const nameIn = (row: string) => row.replace(/^[├└│─\s]+/, "").split(/\s+/)[0];

describe("unusedLines", () => {
    const lines = (tokens: string[], unused: string[]) =>
        unusedLines({ unused, total: tokens.length }, tokens).map(strip);

    it("groups leaves under their parent, in natural order", () => {
        const drawn = lines(
            ["color.red.50", "color.red.100", "color.red.500", "color.blue"],
            ["color.red.500", "color.red.50"],
        );

        expect(drawn[0]).toBe("Group       Unused   Tokens");
        expect(drawn.at(-1)).toBe("color.red        2   50 500");
    });

    it("files top-level tokens under (root), and a $root token under its group's name", () => {
        const drawn = lines(
            ["spacing", "color.accent.$root", "color.accent.soft"],
            ["spacing", "color.accent.$root"],
        );

        expect(drawn.slice(2)).toStrictEqual([
            "(root)        1   spacing",
            "color         1   accent",
        ]);
    });

    it("says all when a whole group is unused", () => {
        expect(
            lines(["color.red.50", "color.red.100"], ["color.red.50", "color.red.100"]).at(-1),
        ).toBe("color.red        2   all");
    });

    it("draws the rule as wide as the widest line, and cuts the last column to the terminal", () => {
        const many = Array.from({ length: 60 }, (_, index) => `space.step-${index}`);
        const drawn = lines([...many, "space.kept"], many);

        expect(drawn[1]?.length).toBe(drawn[2]?.length);
        expect(drawn[2]?.length).toBeLessThanOrEqual(100);
        expect(drawn[2]).toMatch(/…$/);
    });
});

describe("unusedSummary", () => {
    const uses = (forVarReferences: string[], forUtilityClasses: string[]) => ({
        uses: [],
        scanned: { forVarReferences, forUtilityClasses },
        unread: [],
    });

    it("counts stylesheets and markup files apart, each file once", () => {
        const read = uses(
            ["/a/app.css", "/a/card.astro", "/a/base.css"],
            ["/a/card.astro", "/a/page.html"],
        );

        expect(strip(unusedSummary({ unused: ["x"], total: 3 }, read))).toBe(
            "1 of 3 tokens unused. Read 2 stylesheets and 2 markup files.",
        );
    });

    it("counts a markup file read only for its style block as markup", () => {
        const read = uses(["/a/app.css", "/a/card.astro"], []);

        expect(strip(unusedSummary({ unused: ["x"], total: 3 }, read))).toBe(
            "1 of 3 tokens unused. Read 1 stylesheet and 1 markup file.",
        );
    });

    it("says so when nothing is unused", () => {
        expect(strip(unusedSummary({ unused: [], total: 3 }, uses(["/a/app.css"], [])))).toBe(
            "No unused tokens ✨  Read 1 stylesheet and 0 markup files.",
        );
    });
});

describe("impactHeading", () => {
    const doc = readFromMemory({
        files: {
            "tokens.json": JSON.stringify({
                palette: {
                    blue: {
                        $type: "color",
                        $value: { colorSpace: "srgb", components: [0, 0, 1] },
                    },
                },
                color: { brand: { $type: "color", $value: "{palette.blue}" } },
            }),
        },
    });
    const heading = (path: string) => {
        const found = token(doc, path);
        if (!found) throw new Error(path);
        return strip(impactHeading({ token: found, dependents: [], uses: [] }));
    };

    it("shows the token and a value written as a string", () => {
        expect(heading("color.brand")).toBe("color.brand   {palette.blue}");
    });

    it("shows only the token for a value written as an object", () => {
        expect(heading("palette.blue")).toBe("palette.blue");
    });
});

describe("impactLines", () => {
    const chain = answerFor(
        [
            { path: "leaf", references: ["mid"] },
            { path: "mid", references: ["target"] },
            { path: "other", references: ["target"] },
        ],
        [use("/a/a.css", "leaf"), use("/a/b.css", "other"), use("/a/c.css", "other")],
    );

    it("indents each token under the one it references, the most used first", () => {
        const rows = body(impactLines(chain));

        expect(rows.map(nameIn)).toStrictEqual(["target", "other", "mid", "leaf"]);
        expect(rows[1]).toMatch(/^├─ other/);
        expect(rows[2]).toMatch(/^└─ mid/);
        expect(rows[3]).toMatch(/^ {3}└─ leaf/);
    });

    describe("a token with a parent per context", () => {
        const perContext = answerFor([
            { path: "accent", references: ["target"] },
            { path: "danger", references: ["target"] },
            { path: "deep", references: ["shared"] },
            { path: "shared", references: ["accent", "danger"], label: "per variant" },
        ]);
        const rows = body(impactLines(perContext));

        it("lists it under every parent, its subtree under the first only", () => {
            expect(rows.filter((row) => nameIn(row) === "shared")).toHaveLength(2);
            expect(rows.filter((row) => nameIn(row) === "deep")).toHaveLength(1);
        });

        it("names the label on the full row and points the other at it", () => {
            const [full, echo] = rows.filter((row) => nameIn(row) === "shared");

            expect(full).toContain("shared (per variant)");
            expect(echo).toContain("shared (per variant, above)");
        });
    });

    it("hangs a token under the reference it has in the default permutation", () => {
        const rows = body(
            impactLines(
                answerFor([
                    { path: "a", references: ["target"] },
                    { path: "b", references: ["target"] },
                    { path: "shared", references: ["a", "b"], inDefault: "b", label: "per theme" },
                ]),
            ),
        );

        expect(rows.find((row) => row.includes("shared (per theme)"))).toBeDefined();
        expect(rows.find((row) => row.includes("shared (per theme, below)"))).toBeDefined();
        expect(rows.findIndex((row) => row.includes("shared (per theme, below)"))).toBeLessThan(
            rows.findIndex((row) => row.includes("shared (per theme)")),
        );
    });

    it("gives every token one row per parent, however deep the nesting", () => {
        const deep: Dependent[] = [
            { path: "accent", references: ["target"] },
            { path: "danger", references: ["target"] },
            { path: "r.fg", references: ["v.alt", "v.strong"] },
            { path: "r.icon", references: ["v.alt"] },
            { path: "v.alt", references: ["accent", "danger"] },
            { path: "v.strong", references: ["accent", "danger"] },
        ];
        const rows = body(impactLines(answerFor(deep)));

        for (const { path, references } of deep) {
            expect(
                rows.filter((row) => nameIn(row) === path),
                path,
            ).toHaveLength(references.length);
        }
    });

    it("leaves a token with one parent unmarked", () => {
        const rows = body(impactLines(answerFor([{ path: "only", references: ["target"] }])));

        expect(rows.find((row) => nameIn(row) === "only")).not.toContain("(");
    });

    it("draws nothing when nothing references or uses the token", () => {
        expect(impactLines(answerFor([]))).toStrictEqual([]);
    });

    describe("where each token is used", () => {
        const where = (...files: string[]) =>
            body(
                impactLines(
                    answerFor(
                        [],
                        files.map((file) => use(file, "target")),
                    ),
                ),
            )[0]
                ?.split(/\s{3}/)
                .at(-1);

        it("lists up to three files by name, each once", () => {
            expect(where("/a/one.css", "/b/two.css", "/a/one.css")).toBe("one.css  two.css");
        });

        it("counts the rest beyond three", () => {
            expect(where(...["a", "b", "c", "d", "e"].map((n) => `/x/${n}.css`))).toBe(
                "a.css  b.css  +3 more",
            );
        });

        it("names a file's folder when another file has the same name", () => {
            expect(where("/app/blog/page.tsx", "/app/shop/page.tsx", "/app/card.css")).toBe(
                "blog/page.tsx  shop/page.tsx  card.css",
            );
        });

        it("counts files with the same name apart", () => {
            expect(where("/a/page.tsx", "/b/page.tsx", "/c/page.tsx", "/d/page.tsx")).toBe(
                "a/page.tsx  b/page.tsx  +2 more",
            );
        });
    });
});

describe("impactSummary", () => {
    it("counts the uses and the files they are in", () => {
        const answer = answerFor(
            [{ path: "mid", references: ["target"] }],
            [use("/a/a.css", "mid"), use("/a/a.css", "target"), use("/a/b.css", "mid")],
        );

        expect(strip(impactSummary(answer))).toBe("3 uses in 2 files.");
        expect(strip(impactSummary(answerFor([], [use("/a/a.css", "target")])))).toBe(
            "1 use in 1 file.",
        );
    });

    it("says when tokens are built on it but nothing uses any of them", () => {
        expect(strip(impactSummary(answerFor([{ path: "mid", references: ["target"] }])))).toBe(
            "No scanned file uses it or a token built on it.",
        );
    });

    it("says when nothing references or uses the token", () => {
        expect(strip(impactSummary(answerFor([])))).toBe(
            "No token references target, and no scanned file uses it.",
        );
    });
});
