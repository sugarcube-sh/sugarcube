import type { TokenGraph, TokenNode } from "@sugarcube-sh/core";
import { describe, expect, it } from "vitest";
import { usageRoots } from "../src/analyze/usage-roots.js";
import type { VarRef } from "../src/lint/scan-css.js";

function node(id: string, cssName: string, type = "color"): TokenNode {
    return { id, name: id, group: "", type: type as TokenNode["type"], cssName, perContext: {} };
}

function graphOf(...nodes: TokenNode[]): TokenGraph {
    return { contexts: [], edges: [], nodes: new Map(nodes.map((n) => [n.id, n])) };
}

function ref(name: string): VarRef {
    return { name, line: 1, file: "a.css" };
}

describe("usageRoots", () => {
    it("maps a used var name back to its token path", () => {
        const graph = graphOf(node("color.primary", "color-primary"));
        expect([...usageRoots(graph, [ref("--color-primary")])]).toEqual(["color.primary"]);
    });

    it("maps a typography sub-property var to its base token", () => {
        const graph = graphOf(node("text.base", "text-base", "typography"));
        const roots = usageRoots(graph, [ref("--text-base-font-family")]);
        expect([...roots]).toEqual(["text.base"]);
    });

    it("drops references that aren't sugarcube tokens", () => {
        const graph = graphOf(node("color.primary", "color-primary"));
        expect([...usageRoots(graph, [ref("--sl-color-text")])]).toEqual([]);
    });

    it("de-dupes the same token referenced from multiple places", () => {
        const graph = graphOf(node("color.primary", "color-primary"));
        const roots = usageRoots(graph, [ref("--color-primary"), ref("--color-primary")]);
        expect([...roots]).toEqual(["color.primary"]);
    });
});
