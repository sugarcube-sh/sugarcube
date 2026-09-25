import { describe, expect, it } from "vitest";
import type { TokenSources } from "@sugarcube-sh/core/client";
import { createSourceStore } from "../src/store/create-source-store";
import { changedFiles, fileNamed, sources } from "./text-sources";

const colorFile = (s: TokenSources) => fileNamed(s, "color.json");

describe("the store, backed by text", () => {
    it("opens on the base context with tokens readable", () => {
        const { store } = createSourceStore(sources());
        const state = store.getState();

        expect(state.currentContext).toBe("perm:0");
        expect(state.getToken("color.brand.500")).toBeDefined();
    });

    it("sets a token and reflects it in state", () => {
        const { store } = createSourceStore(sources());
        store.getState().setToken("color.brand.500", "#ff0000");

        expect(store.getState().getToken("color.brand.500")).toBe("#ff0000");
        expect(
            JSON.parse(
                store.getState().sources.files[colorFile(store.getState().sources)] as string,
            ).color.brand["500"].$value,
        ).toBe("#ff0000");
    });

    it("renames, and keeps reading through the original handle", () => {
        const { store, getPathIndex } = createSourceStore(sources());

        expect(store.getState().renameNode("color.brand", "primary")).toBe(true);
        expect(getPathIndex().pathOf("color.brand.500")).toBe("color.primary.500");
        expect(store.getState().getToken("color.brand.500")).toBeDefined();
    });

    it("creates a token and hands back a handle that works", () => {
        const { store } = createSourceStore(sources());
        const handle = store.getState().createNode({
            parent: "color.brand",
            name: "950",
            sourcePath: colorFile(store.getState().sources),
            token: { $type: "color", $value: "#001" },
        });

        expect(handle).toBe("color.brand.950");
        expect(store.getState().getToken(handle as string)).toBe("#001");
    });

    it("records one op when a base write fans out over contexts sharing a file", () => {
        const { store, getPathIndex } = createSourceStore(sources());
        const contexts = getPathIndex()
            .entriesFor("radius.md")
            .map((entry) => entry.context);
        expect(contexts.length).toBe(2);

        store.getState().setTokens(
            contexts.map((context) => ({
                path: "radius.md",
                value: { value: 9, unit: "rem" },
                context,
            })),
        );

        expect(store.getState().ops).toHaveLength(1);
    });

    it("records one op per file when the contexts declare the token in different files", () => {
        const { store } = createSourceStore(sources());

        store.getState().setTokens([
            { path: "color.text.default", value: "#111111", context: "perm:0" },
            { path: "color.text.default", value: "#111111", context: "perm:1" },
        ]);

        const files = store.getState().ops.map((op) => op.file.split("/").at(-1));
        expect(files.sort()).toEqual(["color.json", "dark.json"]);
    });

    it("removes a token", () => {
        const { store } = createSourceStore(sources());

        expect(store.getState().removeNode("color.brand.500")).toBe(true);
        expect(store.getState().getToken("color.brand.500")).toBeUndefined();
    });

    it("puts every file back exactly as it was on discard", () => {
        const before = sources();
        const { store } = createSourceStore(before);

        store.getState().setToken("color.brand.500", "#ff0000");
        store.getState().renameNode("color.neutral", "grey");
        expect(store.getState().sources.files).not.toEqual(before.files);

        store.getState().discard();
        expect(store.getState().sources.files).toEqual(before.files);
    });

    it("resets one token to its baseline value, leaving others alone", () => {
        const { store } = createSourceStore(sources());
        const was = store.getState().getToken("color.brand.500");

        store.getState().setToken("color.brand.500", "#ff0000");
        store.getState().setToken("color.brand.400", "#00ff00");
        store.getState().resetToken("color.brand.500");

        expect(store.getState().getToken("color.brand.500")).toEqual(was);
        expect(store.getState().getToken("color.brand.400")).toBe("#00ff00");
    });

    it("keeps the baseline index anchored to what disk says", () => {
        const { store, getBaseline } = createSourceStore(sources());
        store.getState().renameNode("color.brand", "primary");

        expect(getBaseline().index.pathOf("color.brand")).toBe("color.brand");
    });
});

describe("after a save", () => {
    const changed = (store: ReturnType<typeof createSourceStore>["store"], base: TokenSources) =>
        changedFiles(base, store.getState().sources);

    it("stops reporting the saved edits as pending", () => {
        const base = sources();
        const { store } = createSourceStore(base);

        store.getState().setToken("color.brand.500", "#ff0000");
        expect(changed(store, base)).toHaveLength(1);

        store.getState().adopt();
        expect(changedFiles(store.getState().sources, store.getState().sources)).toEqual([]);
    });

    it("discards back to what was saved, not to what came before it", async () => {
        const { store } = createSourceStore(sources());

        store.getState().setToken("color.brand.500", "#ff0000");
        store.getState().adopt();

        store.getState().setToken("color.brand.500", "#00ff00");
        store.getState().discard();

        expect(store.getState().getToken("color.brand.500")).toBe("#ff0000");
    });

    it("re-reports problems against the saved state", () => {
        const { store } = createSourceStore(sources());

        store.getState().setToken("radius.md", "sixteen pixels");
        store.getState().adopt();

        expect(store.getState().problems.size).toBeGreaterThan(0);
    });
});
