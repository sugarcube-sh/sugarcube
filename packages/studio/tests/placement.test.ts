import { describe, expect, it } from "vitest";
import { placementFor, tokenFiles } from "../src/mvp/placement";
import { PathIndex } from "../src/tokens/path-index";
import { groups, resolved } from "./fixtures";

function oneFile() {
    return {
        ...groups({ path: "color", sourcePath: "tokens.json" }),
        ...resolved(
            { path: "color.bg", value: "#fff", sourcePath: "tokens.json" },
            { path: "color.fg", value: "#000", sourcePath: "tokens.json" },
        ),
    };
}

function manyFiles() {
    return {
        ...groups(
            { path: "color", sourcePath: "color.json" },
            { path: "color.brand", sourcePath: "color.json" },
            { path: "space", sourcePath: "space.json" },
        ),
        ...resolved(
            { path: "color.brand.primary", value: "#f00", sourcePath: "color.json" },
            { path: "color.brand.accent", value: "#0f0", sourcePath: "color.json" },
            { path: "space.md", value: 16, sourcePath: "space.json" },
        ),
    };
}

describe("tokenFiles", () => {
    it("lists the distinct files the document draws from", () => {
        const map = manyFiles();
        expect(tokenFiles(new PathIndex(map), map)).toEqual(["color.json", "space.json"]);
    });
});

describe("placementFor", () => {
    it("never asks when there is only one token file", () => {
        const map = oneFile();
        const index = new PathIndex(map);

        expect(placementFor(index, map, "default", "color")).toEqual({
            kind: "settled",
            sourcePath: "tokens.json",
        });
        expect(placementFor(index, map, "default")).toEqual({
            kind: "settled",
            sourcePath: "tokens.json",
        });
    });

    it("follows the file a new token's siblings already use", () => {
        const map = manyFiles();
        const index = new PathIndex(map);

        expect(placementFor(index, map, "default", "color.brand")).toEqual({
            kind: "settled",
            sourcePath: "color.json",
        });
    });

    it("asks when a top-level group is being created", () => {
        const map = manyFiles();

        expect(placementFor(new PathIndex(map), map, "default")).toEqual({
            kind: "ask",
            candidates: ["color.json", "space.json"],
        });
    });

    it("asks when the siblings span more than one file", () => {
        const map = {
            ...groups({ path: "color", sourcePath: "color.json" }),
            ...resolved(
                { path: "color.bg", value: "#fff", sourcePath: "color.json" },
                { path: "color.accent", value: "#f00", sourcePath: "brand.json" },
            ),
        };

        expect(placementFor(new PathIndex(map), map, "default", "color")).toEqual({
            kind: "ask",
            candidates: ["brand.json", "color.json"],
        });
    });

    it("ignores a group's own sourcePath and uses what its tokens say", () => {
        const map = {
            ...groups(
                { path: "color", sourcePath: "tokens.resolver.json" },
                { path: "color.empty", sourcePath: "tokens.resolver.json" },
                { path: "space", sourcePath: "tokens.resolver.json" },
            ),
            ...resolved({ path: "space.md", value: 16, sourcePath: "space.json" }),
        };

        expect(placementFor(new PathIndex(map), map, "default", "color.empty")).toEqual({
            kind: "settled",
            sourcePath: "space.json",
        });
    });

    it("answers per context, so a dark-only sibling does not decide the base", () => {
        const map = {
            ...groups({ path: "color", context: "perm:0", sourcePath: "color.json" }),
            ...resolved(
                { path: "color.bg", value: "#fff", context: "perm:0", sourcePath: "color.json" },
                { path: "color.bg", value: "#000", context: "perm:1", sourcePath: "dark.json" },
            ),
        };
        const index = new PathIndex(map);

        expect(placementFor(index, map, "perm:0", "color")).toEqual({
            kind: "settled",
            sourcePath: "color.json",
        });
        expect(placementFor(index, map, "perm:1", "color")).toEqual({
            kind: "settled",
            sourcePath: "dark.json",
        });
    });

    it("has nothing to offer when the document has no tokens", () => {
        expect(placementFor(new PathIndex({}), {}, "default")).toEqual({ kind: "none" });
    });
});
