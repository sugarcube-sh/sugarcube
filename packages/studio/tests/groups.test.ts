import { describe, expect, it } from "vitest";
import { PathIndex } from "../src/tokens/path-index";
import { type TokenNode, buildTree, isLeaf } from "../src/tokens/groups";

function indexOf(...paths: string[]): PathIndex {
    const resolved = Object.fromEntries(
        paths.map((path, i) => [
            `perm:0.${path}`,
            { $value: i, $type: "number", $path: path, $source: { context: "perm:0" } },
        ]),
    );
    return new PathIndex(resolved as never);
}

/** A readable shape for asserting on a whole subtree. */
function shape(nodes: TokenNode[]): unknown {
    return nodes.map((node) => (isLeaf(node) ? node.name : { [node.name]: shape(node.children) }));
}

/** Walk to a node by name, failing loudly rather than returning undefined. */
function at(nodes: TokenNode[], ...names: string[]): TokenNode {
    let level = nodes;
    let found: TokenNode | undefined;
    for (const name of names) {
        found = level.find((node) => node.name === name);
        if (!found) throw new Error(`no node named ${name} in [${level.map((n) => n.name)}]`);
        level = found.children;
    }
    if (!found) throw new Error("at() needs at least one name");
    return found;
}

describe("buildTree", () => {
    it("derives one root per top-level group", () => {
        const tree = buildTree(indexOf("color.brand.500", "space.md", "radius.sm"));
        expect(tree.map((n) => n.path)).toEqual(["color", "space", "radius"]);
    });

    it("preserves document order rather than sorting, at every depth", () => {
        const tree = buildTree(indexOf("space.md", "space.lg", "space.sm", "color.brand.500"));
        expect(tree.map((n) => n.name)).toEqual(["space", "color"]);
        expect(at(tree, "space").children.map((n) => n.name)).toEqual(["md", "lg", "sm"]);
    });

    it("counts the tokens beneath each node", () => {
        const tree = buildTree(indexOf("color.a", "color.b", "space.md"));
        expect(tree.map((n) => n.count)).toEqual([2, 1]);
    });

    it("counts a token as one", () => {
        const tree = buildTree(indexOf("color.brand.500"));
        expect(at(tree, "color", "brand", "500")).toMatchObject({ name: "500", count: 1 });
    });

    it("nests to whatever depth the document uses", () => {
        const tree = buildTree(indexOf("color.button.primary.background.hover"));
        expect(shape(tree)).toEqual([
            { color: [{ button: [{ primary: [{ background: ["hover"] }] }] }] },
        ]);
    });

    it("gives every node its full path", () => {
        const tree = buildTree(indexOf("color.brand.500"));
        expect(at(tree, "color", "brand", "500").path).toBe("color.brand.500");
    });

    it("marks tokens as leaves and groups as not", () => {
        const tree = buildTree(indexOf("color.brand.500"));
        expect(isLeaf(at(tree, "color"))).toBe(false);
        expect(isLeaf(at(tree, "color", "brand", "500"))).toBe(true);
    });

    it("applies a label override without changing the path", () => {
        const tree = buildTree(indexOf("color.brand.500"), { labels: { color: "Colour" } });
        expect(at(tree, "color")).toMatchObject({ path: "color", title: "Colour" });
    });

    it("labels a nested node by its full path", () => {
        const tree = buildTree(indexOf("color.brand.500"), {
            labels: { "color.brand": "House blue" },
        });
        expect(at(tree, "color", "brand").title).toBe("House blue");
    });

    it("hides a group without inventing one", () => {
        const tree = buildTree(indexOf("color.a", "cube.gap"), { hidden: ["cube"] });
        expect(tree.map((n) => n.path)).toEqual(["color"]);
    });

    // The point of D-036: a document we have never seen still produces a nav.
    it("surfaces a group nothing in Studio knows about", () => {
        const tree = buildTree(indexOf("motion.duration.fast", "elevation.low"));
        expect(tree.map((n) => n.title)).toEqual(["motion", "elevation"]);
    });

    // The title is the string you type in a reference, so it is the name as authored.
    it("titles a node with its name exactly as written", () => {
        const tree = buildTree(indexOf("space.xs", "space.2xl", "space.cluster-gap", "TYPE.XS"));
        expect(at(tree, "space").children.map((n) => n.title)).toEqual([
            "xs",
            "2xl",
            "cluster-gap",
        ]);
        expect(at(tree, "TYPE", "XS").title).toBe("XS");
    });

    // Files are not groups!
    it("treats a group split across sources as one group", () => {
        const tree = buildTree(
            indexOf("color.brand.500", "space.md", "color.neutral.500", "space.lg"),
        );
        expect(shape(tree)).toEqual([
            { color: [{ brand: ["500"] }, { neutral: ["500"] }] },
            { space: ["md", "lg"] },
        ]);
    });

    it("merges two files into one branch rather than two", () => {
        // palette.json gives color.neutral its stops; colors.json gives it roles
        const tree = buildTree(indexOf("color.neutral.500", "color.neutral.text.normal"));
        expect(shape(at(tree, "color").children)).toEqual([
            { neutral: ["500", { text: ["normal"] }] },
        ]);
    });

    it("treats one source holding several groups as several groups", () => {
        const tree = buildTree(
            indexOf("typography.font.body", "typography.text.base", "leading.normal"),
        );
        expect(tree.map((n) => n.path)).toEqual(["typography", "leading"]);
    });

    it("is empty for a document with no tokens", () => {
        expect(buildTree(indexOf())).toEqual([]);
    });
});
