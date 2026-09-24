import { describe, expect, it } from "vitest";
import { buildTree } from "../src/tokens/groups";
import { PathIndex } from "../src/tokens/path-index";
import { isRootPath, stepLabel, stripRoot } from "../src/tokens/paths";
import { resolved } from "./fixtures";

/** The spec's own example, §6.2. */
const ACCENT = resolved(
    { path: "color.accent.$root", type: "color", value: "#dd0000" },
    { path: "color.accent.light", type: "color", value: "#ff2222" },
    { path: "color.accent.dark", type: "color", value: "#aa0000" },
);

function tree(map = ACCENT) {
    return buildTree(new PathIndex(map));
}

describe("isRootPath / stripRoot", () => {
    it("spots a root token and gives back its group", () => {
        expect(isRootPath("color.accent.$root")).toBe(true);
        expect(stripRoot("color.accent.$root")).toBe("color.accent");
    });

    it("leaves an ordinary path alone", () => {
        expect(isRootPath("color.accent.light")).toBe(false);
        expect(stripRoot("color.accent.light")).toBe("color.accent.light");
    });

    it("is not fooled by a token merely containing the word", () => {
        expect(isRootPath("color.$rooted")).toBe(false);
        expect(isRootPath("color.root")).toBe(false);
    });
});

describe("stepLabel", () => {
    it("shows a group's own value as the group", () => {
        expect(stepLabel("color.accent.$root")).toBe("accent");
    });

    it("shows an ordinary token as its own step", () => {
        expect(stepLabel("color.accent.light")).toBe("light");
    });
});

describe("buildTree with a $root token", () => {
    it("does not render it as a child", () => {
        const accent = tree()[0]?.children[0];

        expect(accent?.path).toBe("color.accent");
        expect(accent?.children.map((child) => child.name)).toEqual(["light", "dark"]);
    });

    it("marks the group as carrying its own value", () => {
        expect(tree()[0]?.children[0]?.hasValue).toBe(true);
    });

    it("counts the group's own value alongside its children", () => {
        expect(tree()[0]?.children[0]?.count).toBe(3);
    });

    it("leaves a group without one unmarked", () => {
        const map = resolved(
            { path: "color.brand.500", type: "color", value: "#4d7bd9" },
            { path: "color.brand.900", type: "color", value: "#233263" },
        );
        const brand = tree(map)[0]?.children[0];

        expect(brand?.hasValue).toBeUndefined();
        expect(brand?.count).toBe(2);
    });

    it("handles a group whose only token is its own value", () => {
        const map = resolved({ path: "color.brand.$root", type: "color", value: "#4d7bd9" });
        const brand = tree(map)[0]?.children[0];

        expect(brand?.path).toBe("color.brand");
        expect(brand?.children).toEqual([]);
        expect(brand?.hasValue).toBe(true);
        expect(brand?.count).toBe(1);
    });
});
