import type { TokenGraph, TokenNode } from "@sugarcube-sh/core";
import { beforeAll, describe, expect, it } from "vitest";
import {
    type ImpactRow,
    formatImpactBrief,
    formatImpactTable,
    formatImpactTree,
    formatUnusedTable,
    groupUnused,
    tokenValue,
    whereSummary,
} from "../src/analyze/format.js";
import { UTILITY_SOURCE } from "../src/analyze/scan-utilities.js";
import type { VarRef } from "../src/lint/scan-css.js";
import { strip } from "../src/prompts/common.js";

// The formatters size their columns against the terminal. Pin it so assertions
// don't depend on whoever's window the suite happens to run in.
beforeAll(() => {
    process.stdout.columns = 100;
});

function node(id: string, group: string, name: string, raw?: unknown): TokenNode {
    return {
        id,
        name,
        group,
        type: "color",
        cssName: id.replace(/\./g, "-"),
        perContext: raw === undefined ? {} : { "perm:0": { raw, kind: "primitive" } },
    } as TokenNode;
}

function graphOf(...nodes: TokenNode[]): TokenGraph {
    return { contexts: [], edges: [], nodes: new Map(nodes.map((n) => [n.id, n])) };
}

const ref = (file: string): VarRef => ({ name: "--x", line: 1, file });

describe("whereSummary", () => {
    it("lists up to three distinct files by basename", () => {
        expect(whereSummary([ref("/a/one.css"), ref("/b/two.css")])).toBe("one.css  two.css");
    });

    it("collapses beyond three to a count", () => {
        const refs = ["a", "b", "c", "d", "e"].map((n) => ref(`/x/${n}.css`));
        expect(whereSummary(refs)).toBe("a.css  b.css  +3 more");
    });

    it("counts a file once however many times it appears", () => {
        expect(whereSummary([ref("/a/one.css"), ref("/a/one.css")])).toBe("one.css");
    });

    it("names generated utilities rather than showing the sentinel", () => {
        expect(whereSummary([ref(UTILITY_SOURCE)])).toBe("utilities");
    });
});

describe("groupUnused", () => {
    it("groups leaves under their parent and sorts numerically", () => {
        const graph = graphOf(
            node("color.red.50", "color.red", "50"),
            node("color.red.100", "color.red", "100"),
            node("color.red.500", "color.red", "500"),
        );

        const groups = groupUnused(graph, ["color.red.500", "color.red.50", "color.red.100"]);

        expect(groups).toHaveLength(1);
        // Natural order — not lexicographic, which would put 100 before 50.
        expect(groups[0]?.leaves).toEqual(["50", "100", "500"]);
        expect(groups[0]?.total).toBe(3);
    });

    it("files top-level tokens under (root)", () => {
        const graph = graphOf(node("spacing", "", "spacing"));

        expect(groupUnused(graph, ["spacing"])[0]?.group).toBe("(root)");
    });
});

describe("formatUnusedTable", () => {
    it("collapses a wholly unused group to `all` instead of listing every leaf", () => {
        const graph = graphOf(
            node("color.red.50", "color.red", "50"),
            node("color.red.100", "color.red", "100"),
        );

        const lines = formatUnusedTable(groupUnused(graph, ["color.red.50", "color.red.100"]));

        expect(lines[0]).toContain("Group");
        expect(lines[0]).toContain("Unused");
        expect(lines.at(-1)).toContain("all");
        expect(lines.at(-1)).not.toContain("50");
    });

    it("lists the leaves when only part of a group is unused", () => {
        const graph = graphOf(
            node("color.red.50", "color.red", "50"),
            node("color.red.100", "color.red", "100"),
        );

        expect(formatUnusedTable(groupUnused(graph, ["color.red.50"])).at(-1)).toContain("50");
    });
});

describe("formatImpactTable", () => {
    const rows: ImpactRow[] = [
        { token: "mid", references: "target", refs: 0, where: "" },
        { token: "leaf", references: "mid", refs: 4, where: "a.css" },
    ];

    it("heads the columns and keeps the order it was given", () => {
        const lines = formatImpactTable(rows);

        expect(lines[0]).toContain("Token");
        expect(lines[0]).toContain("References");
        expect(lines[0]).toContain("Uses");
        expect(lines[0]).toContain("Where");
        expect(lines[2]).toContain("mid");
        expect(lines[3]).toContain("leaf");
    });

    it("names the axis when a token references something different per context", () => {
        const lines = formatImpactTable([
            {
                token: "v.on-strong",
                references: "color.info.on-strong",
                axis: "per variant",
                refs: 1,
                where: "app.css",
            },
        ]);

        expect(lines[2]).toContain("color.info.on-strong (per variant)");
    });

    it("leaves a single-parent row unmarked", () => {
        const lines = formatImpactTable([
            { token: "leaf", references: "mid", refs: 1, where: "a.css" },
        ]);

        expect(lines[2]).not.toContain("(");
    });
});

describe("formatImpactBrief", () => {
    it("drops rows nothing uses and ranks the rest by use", () => {
        const lines = formatImpactBrief([
            { token: "quiet", refs: 0, where: "" },
            { token: "small", refs: 2, where: "a.css" },
            { token: "busy", refs: 9, where: "b.css" },
        ]);

        const body = lines.slice(2).join("\n");
        expect(body).not.toContain("quiet");
        expect(body.indexOf("busy")).toBeLessThan(body.indexOf("small"));
    });
});

describe("formatImpactTree", () => {
    it("indents each token under the one it references", () => {
        const parents = new Map([
            ["mid", ["target"]],
            ["leaf", ["mid"]],
            ["other", ["target"]],
        ]);
        const chosen = new Map([
            ["mid", "target"],
            ["leaf", "mid"],
            ["other", "target"],
        ]);
        const refs = new Map([["leaf", [ref("/a/a.css")]]]);

        const lines = formatImpactTree({ target: "target", parents, chosen, refsByToken: refs });
        const body = lines.slice(2);

        expect(lines[0]).toContain("Token");
        expect(body[0]).toContain("target");
        expect(body[1]).toContain("├─ mid");
        expect(body[3]).toContain("└─ other");
        expect(body[2]).toContain("│  └─ leaf");
    });

    describe("a token with a parent per context", () => {
        const parents = new Map([
            ["accent", ["target"]],
            ["danger", ["target"]],
            ["shared", ["accent", "danger"]],
            ["deep", ["shared"]],
        ]);
        const chosen = new Map([
            ["accent", "target"],
            ["danger", "target"],
            ["shared", "accent"],
            ["deep", "shared"],
        ]);
        const elided = new Map([["shared", "per variant"]]);

        it("lists it under every parent", () => {
            const lines = formatImpactTree({
                target: "target",
                parents,
                chosen,
                refsByToken: new Map(),
                elided,
            });

            expect(lines.filter((line) => line.includes("shared"))).toHaveLength(2);
        });

        it("carries the subtree under the chosen parent only", () => {
            const lines = formatImpactTree({
                target: "target",
                parents,
                chosen,
                refsByToken: new Map(),
                elided,
            });

            expect(lines.filter((line) => line.includes("deep"))).toHaveLength(1);
        });

        it("names the axis on the full row and points the echo at it", () => {
            const lines = formatImpactTree({
                target: "target",
                parents,
                chosen,
                refsByToken: new Map(),
                elided,
            });
            const [full, echo] = lines.filter((line) => line.includes("shared"));

            expect(full).toContain("(per variant)");
            expect(echo).toContain("(per variant, above)");
        });
    });

    it("gives every token one row per parent, however deep the nesting", () => {
        const parents = new Map([
            ["accent", ["target"]],
            ["danger", ["target"]],
            ["v.strong", ["accent", "danger"]],
            ["v.alt", ["accent", "danger"]],
            ["r.fg", ["v.strong", "v.alt"]],
            ["r.icon", ["v.alt"]],
        ]);
        const chosen = new Map([
            ["accent", "target"],
            ["danger", "target"],
            ["v.strong", "accent"],
            ["v.alt", "accent"],
            ["r.fg", "v.strong"],
            ["r.icon", "v.alt"],
        ]);

        const lines = formatImpactTree({
            target: "target",
            parents,
            chosen,
            refsByToken: new Map(),
        });
        const rowsFor = (id: string) =>
            lines.filter((line) => strip(line).split(/\s+/).includes(id)).length;

        for (const [token, hops] of parents) {
            expect(rowsFor(token), token).toBe(hops.length);
        }
    });

    it("leaves single-parent tokens unmarked", () => {
        const parents = new Map([["only", ["target"]]]);
        const chosen = new Map([["only", "target"]]);

        const lines = formatImpactTree({
            target: "target",
            parents,
            chosen,
            refsByToken: new Map(),
        });

        expect(lines.find((line) => line.includes("only"))).not.toContain("(per");
    });
});

describe("tokenValue", () => {
    it("shows a value that is authored as a string", () => {
        expect(tokenValue(node("color.brand", "color", "brand", "{palette.blue.500}"))).toContain(
            "{palette.blue.500}",
        );
    });

    it("shows nothing for an object-shaped value", () => {
        expect(tokenValue(node("space.md", "space", "md", { value: 1, unit: "rem" }))).toBe("");
    });

    it("shows nothing when the token has no context", () => {
        expect(tokenValue(node("space.md", "space", "md"))).toBe("");
    });
});
