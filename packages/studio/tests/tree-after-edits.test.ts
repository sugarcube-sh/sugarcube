import { describe, expect, it } from "vitest";
import { buildGroupView } from "../src/mvp/group-view";
import { buildTree } from "../src/tokens/groups";
import { PathIndex } from "../src/tokens/path-index";
import { create, openDocument, rename } from "../src/tokens/source-document";
import { groups, resolved } from "./fixtures";
import { inMemory } from "./text-sources";

const COLOR = `{ "color": { "$type": "color", "blue": { "$value": "#00f" } } }
`;

const open = () => openDocument(inMemory({ "color.json": COLOR }));
const names = (nodes: { name: string }[]) => nodes.map((node) => node.name);

describe("the sidebar tree after an edit", () => {
    it("shows a renamed group under its new name", () => {
        const edit = rename(open(), "color", "palette");
        if (!edit) throw new Error("rename returned null");

        expect(names(buildTree(edit.index))).toEqual(["palette"]);
    });

    it("shows a group that has no tokens in it yet", () => {
        const edit = create(open(), { parent: "color", name: "raw", sourcePath: "color.json" });
        if (!edit) throw new Error("create returned null");

        const color = buildTree(edit.index)[0];
        expect(names(color?.children ?? [])).toContain("raw");
    });
});

describe("the group page after an edit", () => {
    it("lists a child group it contains", () => {
        const edit = create(open(), { parent: "color", name: "raw", sourcePath: "color.json" });
        if (!edit) throw new Error("create returned null");

        const view = buildGroupView(edit.index, edit.resolved, "color", "default");

        expect(names(view?.groups ?? [])).toEqual(["raw"]);
    });

    it("lists only its direct children, not every descendant", () => {
        const map = {
            ...groups(
                { path: "color", sourcePath: "color.json" },
                { path: "color.brand", sourcePath: "color.json" },
            ),
            ...resolved({
                path: "color.brand.primary",
                value: "#f00",
                type: "color",
                sourcePath: "color.json",
            }),
        };
        const index = new PathIndex(map);
        const view = buildGroupView(index, map, "color", "default");

        expect(names(view?.tokens ?? [])).toEqual([]);
        expect(names(view?.groups ?? [])).toEqual(["brand"]);
    });
});
