import { describe, expect, it } from "vitest";
import { placementFor } from "../src/mvp/placement";
import { createSourceStore } from "../src/store/create-source-store";
import { computeDiff } from "../src/tokens/compute-diff";
import { create, openDocument } from "../src/tokens/source-document";
import { fileNamed, inMemory, sources } from "./text-sources";

const COLOR = `{
  "color": {
    "$type": "color",
    "blue": { "$value": "#00f" },
    "text": { "$value": "{color.blue}" }
  }
}
`;
const SPACE = `{ "space": { "$type": "dimension", "md": { "$value": { "value": 1, "unit": "rem" } } } }
`;

const raw = (files: Record<string, string>) => {
    const doc = openDocument(inMemory(files));
    const made = create(doc, { parent: "color", name: "raw", sourcePath: "color.json" });
    if (!made) throw new Error("create returned null");
    return { doc, made };
};

describe("creating a group", () => {
    it("makes a group node with no token in it", () => {
        const { made } = raw({ "color.json": COLOR });

        const handle = made.index.handleAt("color.raw");
        expect(handle).toBeDefined();
        expect(made.index.isGroup(handle as string)).toBe(true);
    });

    it("puts a token created inside it in the group's own file, without asking", () => {
        const { made } = raw({ "color.json": COLOR, "space.json": SPACE });
        const group = made.index.handleAt("color.raw") as string;

        expect(placementFor(made.index, made.resolved, "default", group)).toEqual({
            kind: "settled",
            sourcePath: "color.json",
        });
    });

    it("writes the group, then the token inside it, to the group's own file", () => {
        const base = sources();
        const { store, getPathIndex } = createSourceStore(base);
        const file = fileNamed(base, "color.json");
        const color = getPathIndex().handleAt("color") as string;

        const group = store.getState().createNode({ parent: color, name: "raw", sourcePath: file });
        expect(group).not.toBeNull();

        store.getState().createNode({
            parent: group as string,
            name: "blue",
            sourcePath: file,
            token: { $type: "color", $value: "#00f" },
        });

        expect(store.getState().ops).toEqual([
            { kind: "add", file, path: ["color", "raw"], value: {} },
            {
                kind: "add",
                file,
                path: ["color", "raw", "blue"],
                value: { $type: "color", $value: "#00f" },
            },
        ]);
    });

    it("says nothing about a group that is still empty", () => {
        const { doc, made } = raw({ "color.json": COLOR });

        const diff = computeDiff({
            resolved: made.resolved,
            baseline: { resolved: doc.resolved, trees: doc.trees } as never,
            index: made.index,
            baselineIndex: doc.index,
        });

        expect(diff).toEqual([]);
    });
});
