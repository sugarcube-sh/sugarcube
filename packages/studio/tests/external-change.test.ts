import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import type { TokenSources } from "@sugarcube-sh/core/client";
import { createSourceStore } from "../src/store/create-source-store";
import type { TokenSnapshot } from "../src/tokens/types";
import { changedFiles, fileNamed, sources } from "./text-sources";

const fileEnding = fileNamed;

/** The same edit a person makes in their editor: change one value in the text. */
function edited(s: TokenSources, suffix: string, from: string, to: string): TokenSources {
    const path = fileEnding(s, suffix);
    const text = s.files[path] as string;
    if (!text.includes(from)) throw new Error(`fixture does not contain ${from}`);
    return { ...s, files: { ...s.files, [path]: text.replace(from, to) } };
}

const radiusChanged = (s: TokenSources) =>
    edited(s, "radius.json", '"value": 0.25', '"value": 0.75');
const brandChanged = (s: TokenSources) => edited(s, "color.json", '"#3884f2"', '"#001122"');

/** Stands in for the host: the only field this store reads is `sources`. */
function hostBaseline(s: TokenSources) {
    return createStore<TokenSnapshot>(() => ({ sources: s }) as unknown as TokenSnapshot);
}

function open(before: TokenSources) {
    const baseline = hostBaseline(before);
    const handle = createSourceStore(before, baseline);
    const teardown = handle.activate();
    const arrive = (next: TokenSources) => baseline.setState({ sources: next } as TokenSnapshot);
    return { ...handle, arrive, teardown };
}

describe("when the files change on disk", () => {
    it("takes the new text when nothing is pending", () => {
        const before = sources();
        const { store, arrive } = open(before);

        arrive(radiusChanged(before));

        expect(store.getState().getToken("radius.md")).toEqual({ value: 0.75, unit: "rem" });
        expect(store.getState().conflicts).toEqual([]);
    });

    it("shows nothing as pending afterwards, so Save has nothing to offer", () => {
        const before = sources();
        const { store, arrive } = open(before);

        const outside = radiusChanged(before);
        arrive(outside);

        expect(changedFiles(outside, store.getState().sources)).toEqual([]);
    });

    it("keeps your edit to a file, and reports that file as in conflict", () => {
        const before = sources();
        const { store, arrive } = open(before);

        store.getState().setToken("color.brand.500", "#ff0000");
        arrive(brandChanged(before));

        expect(store.getState().getToken("color.brand.500")).toBe("#ff0000");
        expect(store.getState().conflicts).toEqual([fileEnding(before, "color.json")]);
    });

    it("takes the new text for a file you have not touched, keeping the one you have", () => {
        const before = sources();
        const { store, arrive } = open(before);

        store.getState().setToken("color.brand.500", "#ff0000");
        arrive(radiusChanged(before));

        expect(store.getState().getToken("color.brand.500")).toBe("#ff0000");
        expect(store.getState().getToken("radius.md")).toEqual({ value: 0.75, unit: "rem" });
        expect(store.getState().conflicts).toEqual([]);
    });

    it("keeps both edits when they are different tokens in the same file", () => {
        const before = sources();
        const { store, arrive } = open(before);

        store.getState().setToken("color.brand.500", "#ff0000");
        arrive(
            edited(
                before,
                "color.json",
                '"components": [0.545, 0.195, 258]',
                '"components": [0.545, 0.195, 158]',
            ),
        );

        expect(store.getState().getToken("color.brand.500")).toBe("#ff0000");
        expect(store.getState().getToken("color.brand.600")).toEqual({
            colorSpace: "oklch",
            components: [0.545, 0.195, 158],
            hex: "#0c6ade",
        });
        expect(store.getState().conflicts).toEqual([]);
    });

    it("keeps reading through a handle the outside edit left alone", () => {
        const before = sources();
        const { store, getPathIndex, arrive } = open(before);

        store.getState().renameNode("color.brand", "primary");
        arrive(radiusChanged(before));

        expect(getPathIndex().pathOf("color.brand.500")).toBe("color.primary.500");
        expect(store.getState().getToken("color.brand.500")).toBeDefined();
    });

    it("discards to what disk says now, not to what it said at startup", async () => {
        const before = sources();
        const { store, arrive } = open(before);

        arrive(radiusChanged(before));
        store.getState().setToken("radius.md", { value: 2, unit: "rem" });
        store.getState().discard();

        expect(store.getState().getToken("radius.md")).toEqual({ value: 0.75, unit: "rem" });
    });

    it("stops listening once torn down", () => {
        const before = sources();
        const { store, arrive, teardown } = open(before);

        teardown();
        arrive(radiusChanged(before));

        expect(store.getState().getToken("radius.md")).toEqual({ value: 0.25, unit: "rem" });
    });
});
