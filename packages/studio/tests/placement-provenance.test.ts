import { describe, expect, it } from "vitest";
import { placementFor, tokenFiles } from "../src/mvp/placement";
import { PathIndex } from "../src/tokens/path-index";
import { groups, resolved } from "./fixtures";

const RESOLVER = "tokens.resolver.json";

function realShape() {
    return {
        ...groups(
            { path: "color", sourcePath: RESOLVER },
            { path: "color.brand", sourcePath: RESOLVER },
            { path: "color.empty", sourcePath: RESOLVER },
            { path: "mixed", sourcePath: RESOLVER },
            { path: "space", sourcePath: RESOLVER },
        ),
        ...resolved(
            { path: "color.brand.500", value: "#3884f2", sourcePath: "color.json" },
            { path: "mixed.a", value: "#000", sourcePath: "color.json" },
            { path: "mixed.b", value: 1, sourcePath: "space.json" },
            { path: "space.md", value: 16, sourcePath: "space.json" },
        ),
    };
}

describe("placement never treats the resolver as a token file", () => {
    const map = realShape();
    const index = new PathIndex(map);

    it("lists only the files that actually hold tokens", () => {
        expect(tokenFiles(index, map)).toEqual(["color.json", "space.json"]);
    });

    it("excludes the resolver even when a token claims it", () => {
        const withGenerated = {
            ...map,
            ...resolved(
                { path: "size.step.0", value: 16, sourcePath: RESOLVER },
                { path: "size.step.1", value: 20, sourcePath: RESOLVER },
            ),
            ...groups({ path: "size", sourcePath: RESOLVER }),
        };
        const generatedIndex = new PathIndex(withGenerated);

        const held = new Set(["color.json", "space.json"]);
        expect(tokenFiles(generatedIndex, withGenerated, held)).toEqual([
            "color.json",
            "space.json",
        ]);
        expect(
            JSON.stringify(placementFor(generatedIndex, withGenerated, "default", "size", held)),
        ).not.toContain(RESOLVER);
    });

    // Tokens may be declared inline in a resolver document, and then it is a
    // token file like any other — so it must not be blacklisted by name.
    it("offers the resolver when tokens really are declared in it", () => {
        const inline = {
            ...map,
            ...resolved({ path: "space.md", value: 16, sourcePath: RESOLVER }),
        };
        const held = new Set(["color.json", "space.json", RESOLVER]);

        expect(tokenFiles(new PathIndex(inline), inline, held)).toContain(RESOLVER);
    });

    it("settles on a direct sibling's file", () => {
        expect(placementFor(index, map, "default", "color.brand")).toEqual({
            kind: "settled",
            sourcePath: "color.json",
        });
    });

    it("never proposes the resolver for a group holding no tokens", () => {
        expect(JSON.stringify(placementFor(index, map, "default", "color.empty"))).not.toContain(
            RESOLVER,
        );
    });

    it("falls back to the file its nearest populated ancestor uses", () => {
        expect(placementFor(index, map, "default", "color.empty")).toEqual({
            kind: "settled",
            sourcePath: "color.json",
        });
    });

    it("asks when the siblings genuinely span files", () => {
        expect(placementFor(index, map, "default", "mixed")).toEqual({
            kind: "ask",
            candidates: ["color.json", "space.json"],
        });
    });

    it("asks with token files only when the group is new at the top level", () => {
        expect(placementFor(index, map, "default")).toEqual({
            kind: "ask",
            candidates: ["color.json", "space.json"],
        });
    });
});
