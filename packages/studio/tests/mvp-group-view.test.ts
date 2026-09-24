import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { buildGroupView, firstGroupPath } from "../src/mvp/group-view";
import { baseContext, overrideFiles } from "../src/mvp/token-view";
import { PathIndex } from "../src/tokens/path-index";
import { openDocument, rename } from "../src/tokens/source-document";
import { groups, resolved } from "./fixtures";
import { inMemory } from "./text-sources";

function demo(): ResolvedTokens {
    return {
        ...groups(
            { path: "color", context: "perm:0", sourcePath: "color.json" },
            { path: "color.text", context: "perm:0", sourcePath: "color.json" },
            { path: "color", context: "perm:1", sourcePath: "color.json" },
            { path: "color.text", context: "perm:1", sourcePath: "color.json" },
        ),
        ...resolved(
            {
                path: "color.text.default",
                value: "{color.neutral.900}",
                type: "color",
                context: "perm:0",
                sourcePath: "color.json",
            },
            {
                path: "color.text.muted",
                value: "{color.neutral.600}",
                type: "color",
                context: "perm:0",
                sourcePath: "color.json",
            },
            {
                path: "color.text.default",
                value: "{color.neutral.50}",
                type: "color",
                context: "perm:1",
                sourcePath: "dark.json",
            },
            {
                path: "color.text.muted",
                value: "{color.neutral.600}",
                type: "color",
                context: "perm:1",
                sourcePath: "color.json",
            },
        ),
    };
}

describe("baseContext", () => {
    it("uses the default permutation the pipeline identified", () => {
        expect(baseContext(new PathIndex(demo()), "perm:1")).toBe("perm:1");
    });

    it("falls back to the first context when the pipeline could not decide", () => {
        expect(baseContext(new PathIndex(demo()), null)).toBe("perm:0");
        expect(baseContext(new PathIndex(demo()))).toBe("perm:0");
    });

    it("ignores a default the document does not declare", () => {
        expect(baseContext(new PathIndex(demo()), "perm:9")).toBe("perm:0");
    });
});

describe("firstGroupPath", () => {
    it("is the first top-level group, which is where / lands", () => {
        expect(firstGroupPath(new PathIndex(demo()))).toBe("color");
    });

    it("is undefined when the document declares no groups", () => {
        const index = new PathIndex(resolved({ path: "radius", value: 4 }));
        expect(firstGroupPath(index)).toBeUndefined();
    });
});

describe("buildGroupView", () => {
    const doc = demo();
    const index = new PathIndex(doc);

    it("lists a child group rather than flattening the tokens under it", () => {
        const view = buildGroupView(index, doc, "color", "perm:0");

        expect(view?.tokens).toEqual([]);
        expect(view?.groups.map((row) => row.name)).toEqual(["text"]);
        expect(view?.groups.map((row) => row.path)).toEqual(["color.text"]);
        expect(view?.groups.map((row) => row.count)).toEqual([2]);
    });

    it("names a token by its last segment when it sits directly in the group", () => {
        const view = buildGroupView(index, doc, "color.text", "perm:0");

        expect(view?.tokens.map((row) => row.name)).toEqual(["default", "muted"]);
    });

    it("reads the base declaration's value, whatever the context on screen", () => {
        const view = buildGroupView(index, doc, "color.text", "perm:0");
        const row = view?.tokens.find((token) => token.name === "default");

        expect(row?.value).toBe("{color.neutral.900}");
        expect(row?.sourcePath).toBe("color.json");
        expect(row?.type).toBe("color");
    });

    it("counts a declaration from another file as an override", () => {
        const view = buildGroupView(index, doc, "color.text", "perm:0");
        const row = view?.tokens.find((token) => token.name === "default");

        expect(row?.overrides).toEqual([
            { context: "perm:1", sourcePath: "dark.json", value: "{color.neutral.50}" },
        ]);
        expect(overrideFiles(row!)).toEqual(["dark.json"]);
    });

    it("does not count a context that draws from the base file", () => {
        const view = buildGroupView(index, doc, "color.text", "perm:0");
        const row = view?.tokens.find((token) => token.name === "muted");

        expect(row?.overrides).toEqual([]);
    });

    it("gives a token declared only outside the base an empty value", () => {
        const darkOnly = {
            ...groups({ path: "color", context: "perm:0" }),
            ...groups({ path: "color", context: "perm:1" }),
            ...resolved({
                path: "color.glow",
                value: "#fff",
                context: "perm:1",
                sourcePath: "dark.json",
            }),
        };
        const view = buildGroupView(new PathIndex(darkOnly), darkOnly, "color", "perm:0");
        const row = view?.tokens[0];

        expect(row?.value).toBeUndefined();
        expect(row?.sourcePath).toBeUndefined();
        expect(row?.overrides).toHaveLength(1);
    });

    it("carries the group's own description", () => {
        const described = {
            ...groups({ path: "color", description: "Roles, not ramps.", context: "perm:0" }),
            ...resolved({ path: "color.bg", value: "#fff", context: "perm:0" }),
        };

        expect(
            buildGroupView(new PathIndex(described), described, "color", "perm:0")?.description,
        ).toBe("Roles, not ramps.");
    });

    it("refuses a token handle and an unknown handle", () => {
        expect(buildGroupView(index, doc, "color.text.default", "perm:0")).toBeUndefined();
        expect(buildGroupView(index, doc, "nope", "perm:0")).toBeUndefined();
    });

    it("follows a renamed group, and keeps the handles it reports", () => {
        const text = openDocument(
            inMemory(
                {
                    "color.json": `{ "color": { "$type": "color", "text": {
                        "default": { "$value": "#111" }, "muted": { "$value": "#666" } } } }`,
                    "dark.json": `{ "color": { "text": { "default": { "$value": "#eee" } } } }`,
                },
                { "perm:0": ["color.json"], "perm:1": ["color.json", "dark.json"] },
            ),
        );
        const edit = rename(text, "color.text", "copy");
        if (!edit) throw new Error("rename returned null");

        const renamed = buildGroupView(edit.index, edit.resolved, "color.text", "perm:0");
        expect(renamed?.path).toBe("color.copy");
        expect(renamed?.tokens.map((row) => row.name)).toEqual(["default", "muted"]);
        expect(renamed?.tokens.map((row) => row.handle)).toEqual([
            "color.text.default",
            "color.text.muted",
        ]);

        const parent = buildGroupView(edit.index, edit.resolved, "color", "perm:0");
        expect(parent?.tokens).toEqual([]);
        expect(parent?.groups.map((row) => row.name)).toEqual(["copy"]);
        expect(parent?.groups.map((row) => row.handle)).toEqual(["color.text"]);
        expect(parent?.groups.map((row) => row.count)).toEqual([2]);
    });
});
