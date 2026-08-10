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

        const via = new Map([
            ["mid", "target"],
            ["leaf", "mid"],
            ["other", "target"],
        ]);
        const refs = new Map([["leaf", [ref("/a/a.css")]]]);

        const lines = formatImpactTree("target", via, refs);
        const body = lines.slice(2);

        expect(lines[0]).toContain("Token");
        expect(body[0]).toContain("target");
        expect(body[1]).toContain("├─ mid");
        expect(body[3]).toContain("└─ other");
        expect(body[2]).toContain("leaf");
        expect(body[2]?.indexOf("leaf")).toBeGreaterThan(body[1]?.indexOf("mid") ?? 0);
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
