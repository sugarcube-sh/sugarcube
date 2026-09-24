import { describe, expect, it } from "vitest";
import { computeDiff } from "../src/tokens/compute-diff";
import { create, openDocument, remove, rename, setValue } from "../src/tokens/source-document";
import type { TokenSnapshot } from "../src/tokens/types";
import { fileNamed, sources } from "./text-sources";

const doc = openDocument(sources());
const snapshot = {
    config: {} as never,
    trees: doc.trees,
    resolved: doc.resolved,
} as unknown as TokenSnapshot;

const diffOf = (next: ReturnType<typeof openDocument>) =>
    computeDiff({
        resolved: next.resolved,
        baseline: snapshot,
        index: next.index,
        baselineIndex: doc.index,
    });

describe("the change bar, over a document derived from text", () => {
    it("reports nothing before anything is edited", () => {
        expect(diffOf(doc)).toEqual([]);
    });

    it("reports a value edit", () => {
        const next = setValue(doc, "color.brand.500", "#ff0000", "perm:0");
        expect(diffOf(next as NonNullable<typeof next>).map((entry) => entry.kind)).toEqual([
            "changed",
        ]);
    });

    it("reports a rename of a top-level group, one entry per token under it", () => {
        const next = rename(doc, "typography", "type") as NonNullable<ReturnType<typeof rename>>;
        const entries = diffOf(next);

        expect(entries.length).toBeGreaterThan(0);
        expect(entries.every((entry) => entry.kind === "renamed")).toBe(true);
        expect(entries.map((entry) => [entry.basePath, entry.path])).toContainEqual([
            "typography.font.body",
            "type.font.body",
        ]);
    });

    it("reports a rename deeper in the tree", () => {
        const next = rename(doc, "color.brand", "primary") as NonNullable<
            ReturnType<typeof rename>
        >;
        const entries = diffOf(next);

        expect(entries.some((entry) => entry.basePath === "color.brand.500")).toBe(true);
    });

    it("reports a delete", () => {
        const next = remove(doc, "color.brand.500") as NonNullable<ReturnType<typeof remove>>;
        expect(diffOf(next).some((entry) => entry.kind === "removed")).toBe(true);
    });

    it("reports a referrer as changed when what it points at is renamed", () => {
        const next = rename(doc, "color.brand", "primary") as NonNullable<
            ReturnType<typeof rename>
        >;
        const referrer = diffOf(next).find((entry) => entry.handle === "color.text.brand");

        expect(referrer?.kind).toBe("changed");
        expect(referrer?.to.$value).toBe("{color.primary.700}");
    });

    it("reports a created token as added, with no basePath", () => {
        const next = create(doc, {
            parent: "color",
            name: "highlight",
            sourcePath: fileNamed(doc.sources, "color.json"),
            token: { $type: "color", $value: "#ccc" },
        }) as NonNullable<ReturnType<typeof create>>;
        const added = diffOf(next).filter((entry) => entry.kind === "added");

        expect(added).toHaveLength(1);
        expect(added[0]).toMatchObject({ handle: "color.highlight", path: "color.highlight" });
        expect(added[0]?.basePath).toBeUndefined();
        expect(added[0]?.to.$value).toBe("#ccc");
    });

    it("reports a rename plus a value edit as one renamed entry", () => {
        const moved = rename(doc, "color.brand.500", "mid") as NonNullable<
            ReturnType<typeof rename>
        >;
        const next = setValue(moved, "color.brand.500", "#ff0000", "perm:0") as NonNullable<
            ReturnType<typeof setValue>
        >;
        const entries = diffOf(next).filter((entry) => entry.handle === "color.brand.500");

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            kind: "renamed",
            path: "color.brand.mid",
            basePath: "color.brand.500",
        });
        expect(entries[0]?.to.$value).toBe("#ff0000");
    });
});
