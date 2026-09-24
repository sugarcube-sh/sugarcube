import { describe, expect, it } from "vitest";
import { createSourceStore } from "../src/store/create-source-store";
import { writeOpsToDisk } from "../src/server/write-ops-to-disk";
import { type WriteOp, WriteOpFailed, applyWriteOps, opsByFile } from "../src/tokens/write-ops";
import { fileNamed, sources } from "./text-sources";

const fileEnding = fileNamed;

/** Applies the recorded operations to a disk that may have moved underneath. */
function replay(disk: Record<string, string>, ops: readonly WriteOp[]) {
    const written = { ...disk };
    return writeOpsToDisk(
        {
            read: async (path) => written[path] as string,
            write: async (path, text) => {
                written[path] = text;
            },
        },
        opsByFile(ops),
    ).then(() => written);
}

describe("what an edit records", () => {
    it("records setting a value as one set at that path", () => {
        const base = sources();
        const { store } = createSourceStore(base);
        store.getState().setToken("color.brand.500", "#ff0000");

        expect(store.getState().ops).toEqual([
            {
                kind: "set",
                file: fileEnding(base, "color.json"),
                path: ["color", "brand", "500", "$value"],
                value: "#ff0000",
            },
        ]);
    });

    it("records a rename as one key move, plus a set for each reference", () => {
        const base = sources();
        const { store } = createSourceStore(base);
        store.getState().renameNode("color.brand", "primary");

        const ops = store.getState().ops;
        const moves = ops.filter((op) => op.kind === "renameKey");

        expect(moves).toEqual([
            {
                kind: "renameKey",
                file: fileEnding(base, "color.json"),
                path: ["color", "brand"],
                name: "primary",
            },
        ]);
        expect(ops.filter((op) => op.kind === "set").length).toBeGreaterThan(0);
    });

    it("records nothing before anything is edited", () => {
        const { store } = createSourceStore(sources());
        expect(store.getState().ops).toEqual([]);
    });

    it("forgets them on discard, and on adopt after a save", async () => {
        const { store } = createSourceStore(sources());

        store.getState().setToken("color.brand.500", "#ff0000");
        store.getState().discard();
        expect(store.getState().ops).toEqual([]);

        store.getState().setToken("color.brand.500", "#00ff00");
        store.getState().adopt();
        expect(store.getState().ops).toEqual([]);
    });
});

describe("replaying them onto disk", () => {
    it("keeps a change made to the same file underneath", async () => {
        const base = sources();
        const color = fileEnding(base, "color.json");
        const { store } = createSourceStore(base);

        store.getState().setToken("color.brand.500", "#ff0000");

        // Someone edits a different token in that file while Studio holds the edit.
        const disk = {
            ...base.files,
            [color]: (base.files[color] as string).replace(
                '"components": [0.545, 0.195, 258]',
                '"components": [0.545, 0.195, 158]',
            ),
        };

        const written = await replay(disk, store.getState().ops);
        const after = JSON.parse(written[color] as string);

        expect(after.color.brand["500"].$value).toBe("#ff0000");
        expect(after.color.brand["600"].$value.components).toEqual([0.545, 0.195, 158]);
    });

    it("leaves every line it did not edit byte for byte as it was", async () => {
        const base = sources();
        const radius = fileEnding(base, "radius.json");
        const { store } = createSourceStore(base);

        store.getState().setToken("radius.md", { value: 0.75, unit: "rem" });

        const written = await replay(base.files, store.getState().ops);
        const after = (written[radius] as string).split("\n");
        const untouched = (base.files[radius] as string)
            .split("\n")
            .filter((line) => !line.includes('"md":'));

        for (const line of untouched) expect(after).toContain(line);
    });

    it("moves a key without reordering the file", async () => {
        const base = sources();
        const color = fileEnding(base, "color.json");
        const { store } = createSourceStore(base);

        store.getState().renameNode("color.brand", "primary");

        const written = await replay(base.files, store.getState().ops);
        const after = JSON.parse(written[color] as string);

        expect(Object.keys(after.color)).toEqual(
            Object.keys(JSON.parse(base.files[color] as string).color).map((key) =>
                key === "brand" ? "primary" : key,
            ),
        );
        expect(after.color.primary.$description).toBeDefined();
    });

    it("writes no file at all when one operation cannot apply", async () => {
        const base = sources();
        const color = fileEnding(base, "color.json");
        const radius = fileEnding(base, "radius.json");

        const ops: WriteOp[] = [
            { kind: "set", file: radius, path: ["radius", "md", "$value"], value: 1 },
            { kind: "renameKey", file: color, path: ["color", "gone"], name: "nope" },
        ];

        const written = { ...base.files };
        await expect(
            writeOpsToDisk(
                {
                    read: async (path) => written[path] as string,
                    write: async (path, text) => {
                        written[path] = text;
                    },
                },
                opsByFile(ops),
            ),
        ).rejects.toThrow(WriteOpFailed);

        expect(written[radius]).toBe(base.files[radius]);
    });

    it("applies each file's operations in the order they were recorded", () => {
        const text = '{\n  "a": { "$value": 1 }\n}';
        const result = applyWriteOps(
            text,
            [
                { kind: "renameKey", path: ["a"], name: "b" },
                { kind: "set", path: ["b", "$value"], value: 2 },
            ],
            "x.json",
        );

        expect(JSON.parse(result)).toEqual({ b: { $value: 2 } });
    });
});
