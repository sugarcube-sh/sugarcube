import { describe, expect, it } from "vitest";
import { createSourceStore } from "../src/store/create-source-store";
import { opsByFile } from "../src/tokens/write-ops";
import { sources } from "./text-sources";

/** What the save bundle would hold: one entry per file, with its operations. */
const bundle = (store: ReturnType<typeof createSourceStore>["store"]) =>
    opsByFile(store.getState().ops);

describe("what a save carries", () => {
    it("says nothing changed before anything is edited", () => {
        const { store } = createSourceStore(sources());

        expect(bundle(store)).toEqual([]);
    });

    it("carries only the file an edit touched", () => {
        const { store } = createSourceStore(sources());
        store.getState().setToken("color.brand.500", "#ff0000");

        const changed = bundle(store);
        expect(changed).toHaveLength(1);
        expect(changed[0]?.path.endsWith("color.json")).toBe(true);
        expect(changed[0]?.ops).toHaveLength(1);
    });

    it("carries every file a rename reached", () => {
        const { store } = createSourceStore(sources());
        store.getState().renameNode("color.brand", "primary");

        expect(
            bundle(store)
                .map((file) => file.path.split("/").at(-1))
                .sort(),
        ).toEqual(["border.json", "color.json", "dark.json", "gradient.json"]);
    });

    // The point of the whole model: what is sent is what the edit did, so the
    // file on disk decides everything the edit did not touch.
    it("carries no file text at all", () => {
        const { store } = createSourceStore(sources());
        store.getState().renameNode("color.brand", "primary");

        for (const file of bundle(store)) {
            expect(JSON.stringify(file)).not.toContain("$description");
        }
    });

    it("carries nothing again once the edits are discarded", async () => {
        const { store } = createSourceStore(sources());
        store.getState().setToken("color.brand.500", "#ff0000");
        store.getState().discard();

        expect(bundle(store)).toEqual([]);
    });
});
