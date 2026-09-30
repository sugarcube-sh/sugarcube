import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { readFromMemory } from "../../src/index.js";
import { read } from "../../src/node.js";

const folder = join(import.meta.dirname, "../read/cases/every-combination/input");

function inMemory() {
    const files = Object.fromEntries(
        readdirSync(folder, { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => {
                const path = join(entry.parentPath, entry.name);
                return [relative(folder, path).replaceAll("\\", "/"), readFileSync(path, "utf8")];
            }),
    );
    return readFromMemory({ files, entry: "tokens.resolver.json" });
}

describe("read from disk", () => {
    it("reads an entry given as an absolute path, with paths in the result relative to its folder", async () => {
        const doc = await read(join(folder, "tokens.resolver.json"));
        expect(doc.files).toStrictEqual([
            "tokens.resolver.json",
            "base.json",
            "dark.json",
            "ocean.json",
        ]);
        expect(doc).toStrictEqual(inMemory());
    });

    it("reads an entry given relative to the working directory", async () => {
        const doc = await read(join(relative(process.cwd(), folder), "tokens.resolver.json"));
        expect(doc).toStrictEqual(inMemory());
    });

    it("reports a file that is not there, and does not throw", async () => {
        const doc = await read(join(folder, "missing.resolver.json"));
        expect(doc.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
            { kind: "file-not-found", detail: { file: "missing.resolver.json" } },
        ]);
    });
});
