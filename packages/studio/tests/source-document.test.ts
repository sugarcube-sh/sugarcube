import { composeTrees, resolveTokens } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { create, openDocument, remove, rename, setValue } from "../src/tokens/source-document";
import { fileNamed, sources } from "./text-sources";

const BASE = "perm:0";
const read = (doc: ReturnType<typeof openDocument>, path: string, context = BASE) =>
    doc.index.readValue(doc.resolved, path, context);

describe("a document backed by its own files", () => {
    it("opens with every token readable", () => {
        const doc = openDocument(sources());

        expect(Object.keys(doc.resolved).length).toBeGreaterThan(200);
        expect(read(doc, "color.brand.500")).toBeDefined();
        expect(doc.index.pathOf("color.brand.500")).toBe("color.brand.500");
    });

    it("writes a value into the file it came from, and reads it back", () => {
        const doc = openDocument(sources());
        const next = setValue(doc, "color.brand.500", "#ff0000", BASE);
        if (!next) throw new Error("setValue returned null");

        expect(read(next, "color.brand.500")).toBe("#ff0000");

        const file = Object.keys(next.sources.files).find((p) =>
            p.endsWith("color.json"),
        ) as string;
        expect(JSON.parse(next.sources.files[file] as string).color.brand["500"].$value).toBe(
            "#ff0000",
        );
    });

    it("leaves every other file untouched", () => {
        const doc = openDocument(sources());
        const next = setValue(doc, "color.brand.500", "#ff0000", BASE) as NonNullable<
            ReturnType<typeof setValue>
        >;

        for (const [path, text] of Object.entries(doc.sources.files)) {
            if (path.endsWith("color.json")) continue;
            expect(next.sources.files[path]).toBe(text);
        }
    });

    // Under model A this needed a manual fan-out across contexts. Editing the
    // file does it, because every permutation that includes the file sees it.
    it("reaches every context drawing on that file, with no fan-out", () => {
        const doc = openDocument(sources());
        const next = setValue(doc, "color.brand.500", "#ff0000", BASE) as NonNullable<
            ReturnType<typeof setValue>
        >;

        expect(read(next, "color.brand.500", "perm:1")).toBe("#ff0000");
    });

    it("keeps a handle pointing at the node after a rename", () => {
        const doc = openDocument(sources());
        const next = rename(doc, "color.brand", "primary");
        if (!next) throw new Error("rename returned null");

        expect(next.index.pathOf("color.brand")).toBe("color.primary");
        expect(next.index.pathOf("color.brand.500")).toBe("color.primary.500");
        expect(next.index.handleAt("color.primary.500")).toBe("color.brand.500");
    });

    // The handle is the key, so nothing translates: read by the name it had.
    it("still reads by the original handle after a rename", () => {
        const doc = openDocument(sources());
        const before = read(doc, "color.brand.500");
        const next = rename(doc, "color.brand", "primary") as NonNullable<
            ReturnType<typeof rename>
        >;

        expect(read(next, "color.brand.500")).toEqual(before);
        expect(next.index.pathOf("color.brand.500")).toBe("color.primary.500");
    });

    it("edits through the old handle after a rename", () => {
        const doc = openDocument(sources());
        const renamed = rename(doc, "color.brand", "primary") as NonNullable<
            ReturnType<typeof rename>
        >;
        const edited = setValue(renamed, "color.brand.500", "#00ff00", BASE);
        if (!edited) throw new Error("setValue after rename returned null");

        expect(read(edited, "color.brand.500")).toBe("#00ff00");

        const file = Object.keys(edited.sources.files).find((p) =>
            p.endsWith("color.json"),
        ) as string;
        expect(JSON.parse(edited.sources.files[file] as string).color.primary["500"].$value).toBe(
            "#00ff00",
        );
    });

    it("refuses a name that would collide with a sibling", () => {
        const doc = openDocument(sources());
        expect(rename(doc, "color.brand", "neutral")).toBe(null);
    });

    it("refuses a name with a dot in it", () => {
        const doc = openDocument(sources());
        expect(rename(doc, "color.brand", "a.b")).toBe(null);
    });
});

describe("creating and removing", () => {
    const colorFile = (doc: ReturnType<typeof openDocument>) =>
        fileNamed(doc.sources, "color.json");

    it("writes a new token into the file it was told to", () => {
        const doc = openDocument(sources());
        const file = colorFile(doc);
        const next = create(doc, {
            parent: "color.brand",
            name: "950",
            sourcePath: file,
            token: { $type: "color", $value: "#001" },
        });
        if (!next) throw new Error("create returned null");

        expect(read(next, "color.brand.950")).toBe("#001");
        expect(JSON.parse(next.sources.files[file] as string).color.brand["950"]).toEqual({
            $type: "color",
            $value: "#001",
        });
    });

    // Model A wrote nothing for an empty group, so creating one looked inert.
    // The file records it, because the file is the working copy.
    it("writes a new group as an empty object", () => {
        const doc = openDocument(sources());
        const file = colorFile(doc);
        const next = create(doc, { parent: "color", name: "raw", sourcePath: file });
        if (!next) throw new Error("create returned null");

        expect(JSON.parse(next.sources.files[file] as string).color.raw).toEqual({});
        expect(next.index.handleAt("color.raw")).toBe("color.raw");
    });

    it("refuses a name already taken", () => {
        const doc = openDocument(sources());
        expect(create(doc, { parent: "color", name: "brand", sourcePath: colorFile(doc) })).toBe(
            null,
        );
    });

    it("removes a token and leaves its siblings in order", () => {
        const doc = openDocument(sources());
        const file = colorFile(doc);
        const was = Object.keys(JSON.parse(doc.sources.files[file] as string).color.brand);
        const next = remove(doc, "color.brand.500");
        if (!next) throw new Error("remove returned null");

        expect(read(next, "color.brand.500")).toBeUndefined();
        expect(Object.keys(JSON.parse(next.sources.files[file] as string).color.brand)).toEqual(
            was.filter((key) => key !== "500"),
        );
    });

    it("removes a group with everything under it", () => {
        const doc = openDocument(sources());
        const next = remove(doc, "color.brand");
        if (!next) throw new Error("remove returned null");

        expect(next.index.pathOf("color.brand.500") !== undefined).toBe(false);
        expect(
            JSON.parse(next.sources.files[colorFile(next)] as string).color.brand,
        ).toBeUndefined();
    });

    // D-041: the pipeline decides. A delete that orphans referrers is reported,
    // not prevented.
    it("lets a delete dangle its referrers, and the pipeline says so", () => {
        const doc = openDocument(sources());
        const next = remove(doc, "color.brand") as NonNullable<ReturnType<typeof remove>>;
        const errors = resolveTokens(composeTrees(next.sources).trees).errors.resolution;

        expect(Object.keys(errors).length).toBeGreaterThan(0);
        expect(JSON.stringify(errors)).toContain("color.brand");
    });

    it("forgets the handle of something removed", () => {
        const doc = openDocument(sources());
        const next = remove(doc, "color.brand.500") as NonNullable<ReturnType<typeof remove>>;

        expect(next.index.pathOf("color.brand.500") !== undefined).toBe(false);
        expect(next.index.pathOf("color.brand.400")).toBe("color.brand.400");
    });
});

describe("identity across edits", () => {
    it("gives a node created at a name a rename vacated its own handle", () => {
        const doc = openDocument(sources());
        const renamed = rename(doc, "color.brand", "primary");
        if (!renamed) throw new Error("rename returned null");
        const created = create(renamed, {
            parent: "color",
            name: "brand",
            sourcePath: fileNamed(doc.sources, "color.json"),
        });
        if (!created) throw new Error("create returned null");

        expect(created.index.handleAt("color.primary")).toBe("color.brand");
        expect(created.index.pathOf("color.brand")).toBe("color.primary");

        const fresh = created.index.handleAt("color.brand");
        expect(fresh).toBeDefined();
        expect(fresh).not.toBe("color.brand");
        expect(created.index.pathOf(fresh as string)).toBe("color.brand");
    });
});
