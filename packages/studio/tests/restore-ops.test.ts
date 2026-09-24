import { describe, expect, it } from "vitest";
import { createSourceStore } from "../src/store/create-source-store";
import { decodeOps, encodeOps } from "../src/tokens/ops-codec";
import type { WriteOp } from "../src/tokens/write-ops";
import { sources } from "./text-sources";

const PATH = "color.text.brand";

function edited() {
    const { store } = createSourceStore(sources());
    store.getState().setToken(PATH, "{color.brand.800}");
    store.getState().renameNode("radius.md", "medium");
    return store.getState().ops;
}

describe("an operation list as a string", () => {
    it("round-trips through gzip and base64url", async () => {
        const ops = edited();

        const text = await encodeOps(ops);

        expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(await decodeOps(text)).toEqual(ops);
    });

    it("is smaller than the operations it encodes", async () => {
        const ops = edited();

        const text = await encodeOps(ops);

        expect(text.length).toBeLessThan(JSON.stringify(ops).length);
    });

    it("refuses text that is not an operation list", async () => {
        await expect(decodeOps("nope")).rejects.toThrow();
    });
});

describe("a store rebuilt from a stash, as a dock is after its page reloads", () => {
    it("holds the edits again, still pending", () => {
        const ops = edited();

        const { store, getPathIndex } = createSourceStore(sources(), undefined, { restore: ops });

        expect(store.getState().getToken(PATH)).toBe("{color.brand.800}");
        expect(getPathIndex().pathOf("radius.md")).toBe("radius.medium");
        expect(store.getState().ops).toEqual(ops);
    });

    it("keeps the baseline as disk, so discard still works", async () => {
        const ops = edited();
        const { store } = createSourceStore(sources(), undefined, { restore: ops });

        store.getState().discard();

        expect(store.getState().getToken(PATH)).toBe("{color.brand.700}");
        expect(store.getState().ops).toEqual([]);
    });

    it("keeps a node's identity through two renames of it", () => {
        const { store } = createSourceStore(sources());
        store.getState().renameNode("radius.md", "medium");
        store.getState().renameNode("radius.md", "mid");
        const ops = store.getState().ops;

        const restored = createSourceStore(sources(), undefined, { restore: ops });

        expect(restored.getPathIndex().pathOf("radius.md")).toBe("radius.mid");
        expect(restored.store.getState().ops).toEqual(ops);
    });

    it("keeps a node's identity through a rename of its group and then of itself", () => {
        const { store } = createSourceStore(sources());
        store.getState().renameNode("radius", "corner");
        store.getState().renameNode("radius.md", "medium");
        const ops = store.getState().ops;

        const restored = createSourceStore(sources(), undefined, { restore: ops });

        expect(restored.getPathIndex().pathOf("radius.md")).toBe("corner.medium");
        expect(restored.getPathIndex().pathOf("radius.sm")).toBe("corner.sm");
    });

    it("drops a stash that no longer applies, rather than half-applying it", () => {
        const ops: WriteOp[] = [
            { kind: "renameKey", file: "does-not-exist.json", path: ["color"], name: "colour" },
        ];

        const { store } = createSourceStore(sources(), undefined, { restore: ops });

        expect(store.getState().ops).toEqual([]);
        expect(store.getState().getToken(PATH)).toBe("{color.brand.700}");
    });
});
