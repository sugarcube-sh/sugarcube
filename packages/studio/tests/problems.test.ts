import { describe, expect, it } from "vitest";
import { openDocument, remove, rename, setValue } from "../src/tokens/source-document";
import { sources } from "./text-sources";
const BASE = "perm:0";

describe("what the pipeline says is wrong", () => {
    it("says nothing about a document that is fine", () => {
        expect(openDocument(sources()).problems.size).toBe(0);
    });

    // D-041: the field parses, the pipeline rules. Studio never refuses the
    // edit — it reports what core made of it.
    it("reports a value core cannot make sense of", () => {
        const doc = openDocument(sources());
        const next = setValue(doc, "space.md", "sixteen pixels", BASE);
        if (!next) throw new Error("setValue returned null");

        expect(next.problems.get("space.md")?.[0]?.kind).toBe("invalid");
    });

    it("keeps the edit anyway, so the text is what you typed", () => {
        const doc = openDocument(sources());
        const next = setValue(doc, "space.md", "sixteen pixels", BASE) as NonNullable<
            ReturnType<typeof setValue>
        >;

        expect(next.index.readValue(next.resolved, "space.md", BASE)).toBe("sixteen pixels");
    });

    it("complains once, not once per permutation", () => {
        const doc = openDocument(sources());
        const next = setValue(doc, "space.md", "sixteen pixels", BASE) as NonNullable<
            ReturnType<typeof setValue>
        >;

        expect(next.problems.get("space.md")).toHaveLength(1);
    });

    it("marks the referrers when a delete orphans them", () => {
        const doc = openDocument(sources());
        const next = remove(doc, "color.brand.500");
        if (!next) throw new Error("remove returned null");

        const orphaned = [...next.problems].filter(([, list]) =>
            list.some((problem) => problem.kind === "missing-reference"),
        );

        expect(orphaned.length).toBeGreaterThan(0);
        expect(orphaned[0]?.[1][0]?.ref).toContain("color.brand.500");
    });

    it("marks nothing when a rename carries its references with it", () => {
        const doc = openDocument(sources());
        const next = rename(doc, "color.brand", "primary");
        if (!next) throw new Error("rename returned null");

        expect(next.problems.size).toBe(0);
    });

    it("clears once the problem is fixed", () => {
        const doc = openDocument(sources());
        const broken = setValue(doc, "space.md", "sixteen pixels", BASE) as NonNullable<
            ReturnType<typeof setValue>
        >;
        expect(broken.problems.size).toBeGreaterThan(0);

        const fixed = setValue(broken, "space.md", { value: 16, unit: "px" }, BASE);
        expect(fixed?.problems.size).toBe(0);
    });

    it("finds the problem by the handle a node had before it moved", () => {
        const doc = openDocument(sources());
        const renamed = rename(doc, "space", "spacing") as NonNullable<ReturnType<typeof rename>>;
        const broken = setValue(renamed, "space.md", "sixteen pixels", BASE) as NonNullable<
            ReturnType<typeof setValue>
        >;

        expect(broken.index.pathOf("space.md")).toBe("spacing.md");
        expect(broken.problems.get("space.md")?.[0]?.kind).toBe("invalid");
    });
});
