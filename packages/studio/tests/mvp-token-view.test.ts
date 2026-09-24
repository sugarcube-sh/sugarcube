import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { buildTokenRow } from "../src/mvp/token-view";
import { PathIndex } from "../src/tokens/path-index";
import { openDocument, rename } from "../src/tokens/source-document";
import { groups, resolved } from "./fixtures";
import { inMemory } from "./text-sources";

function doc(): ResolvedTokens {
    return {
        ...groups(
            { path: "color", context: "perm:0", sourcePath: "color.json" },
            { path: "color", context: "perm:1", sourcePath: "color.json" },
        ),
        ...resolved(
            {
                path: "color.text",
                value: "{color.neutral.900}",
                type: "color",
                context: "perm:0",
                sourcePath: "color.json",
            },
            {
                path: "color.text",
                value: "{color.neutral.50}",
                type: "color",
                context: "perm:1",
                sourcePath: "dark.json",
            },
        ),
    };
}

describe("buildTokenRow", () => {
    const document = doc();
    const index = new PathIndex(document);

    it("names the token by its last segment", () => {
        expect(buildTokenRow(index, document, "color.text", "perm:0")?.name).toBe("text");
    });

    it("takes a name from the caller, which is how a group table labels a nested row", () => {
        expect(buildTokenRow(index, document, "color.text", "perm:0", "text.default")?.name).toBe(
            "text.default",
        );
    });

    it("carries the base declaration and every override", () => {
        const row = buildTokenRow(index, document, "color.text", "perm:0");

        expect(row?.path).toBe("color.text");
        expect(row?.type).toBe("color");
        expect(row?.value).toBe("{color.neutral.900}");
        expect(row?.sourcePath).toBe("color.json");
        expect(row?.overrides).toEqual([
            { context: "perm:1", sourcePath: "dark.json", value: "{color.neutral.50}" },
        ]);
    });

    it("follows a rename, keeping the handle it was asked about", () => {
        const text = openDocument(
            inMemory(
                {
                    "color.json": `{ "color": { "$type": "color", "text": { "$value": "#111" } } }`,
                    "dark.json": `{ "color": { "text": { "$value": "#eee" } } }`,
                },
                { "perm:0": ["color.json"], "perm:1": ["color.json", "dark.json"] },
            ),
        );
        const edit = rename(text, "color.text", "ink");
        if (!edit) throw new Error("rename returned null");

        const row = buildTokenRow(edit.index, edit.resolved, "color.text", "perm:0");
        expect(row?.path).toBe("color.ink");
        expect(row?.name).toBe("ink");
        expect(row?.handle).toBe("color.text");
    });

    it("refuses a group handle and an unknown handle", () => {
        expect(buildTokenRow(index, document, "color", "perm:0")).toBeUndefined();
        expect(buildTokenRow(index, document, "nope", "perm:0")).toBeUndefined();
    });

    it("reports a token declared only outside the base as having no value", () => {
        const darkOnly = {
            ...groups({ path: "color", context: "perm:0" }),
            ...resolved({
                path: "color.glow",
                value: "#fff",
                context: "perm:1",
                sourcePath: "dark.json",
            }),
        };
        const row = buildTokenRow(new PathIndex(darkOnly), darkOnly, "color.glow", "perm:0");

        expect(row?.value).toBeUndefined();
        expect(row?.sourcePath).toBeUndefined();
        expect(row?.type).toBe("dimension");
        expect(row?.overrides).toEqual([
            { context: "perm:1", sourcePath: "dark.json", value: "#fff" },
        ]);
    });
});
