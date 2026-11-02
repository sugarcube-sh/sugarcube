import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readFromMemory } from "../../src/index.js";
import { getAbsoluteFilePath, read } from "../../src/node.js";

const folder = join(import.meta.dirname, "../read/cases/every-combination/input");

describe("design tokens read from disk", () => {
    it("name the entry by its file name, and give each file's text by their name for it", async () => {
        const tokens = await read(join(folder, "tokens.resolver.json"));
        const { entry, files } = tokens.toMemory();
        expect(entry).toBe("tokens.resolver.json");
        expect(Object.keys(files)).toStrictEqual(tokens.files);
        for (const file of tokens.files) {
            expect(files[file]).toBe(readFileSync(join(folder, file), "utf8"));
        }
    });

    it("read again from memory, with the same options, to the same design tokens", async () => {
        const options = { hexStringColors: true };
        const tokens = await read(join(folder, "tokens.resolver.json"), options);
        expect(readFromMemory(tokens.toMemory(), options)).toStrictEqual(tokens);
    });
});

describe("fileOnDisk", () => {
    it("is where each file the design tokens name was read from", async () => {
        const entry = join(folder, "tokens.resolver.json");
        const tokens = await read(entry);
        for (const file of tokens.files) {
            expect(readFileSync(getAbsoluteFilePath(entry, file), "utf8")).toBe(
                tokens.getText(file),
            );
        }
    });

    it.for([
        {
            entry: "/work/tokens/tokens.resolver.json",
            file: "themes/dark.json",
            expected: "/work/tokens/themes/dark.json",
        },
        {
            entry: "/work/tokens/tokens.resolver.json",
            file: "../shared/base.json",
            expected: "/work/shared/base.json",
        },
        { entry: "/work/tokens.json", file: "tokens.json", expected: "/work/tokens.json" },
        {
            entry: "\\work\\tokens\\tokens.resolver.json",
            file: "dark.json",
            expected: "/work/tokens/dark.json",
        },
    ])("puts $file, read from $entry, at $expected", ({ entry, file, expected }) => {
        expect(getAbsoluteFilePath(entry, file)).toBe(expected);
    });

    it("is absolute for an entry given relative to where the process runs", () => {
        expect(getAbsoluteFilePath("tokens/tokens.resolver.json", "dark.json")).toBe(
            join(process.cwd(), "tokens/dark.json").replaceAll("\\", "/"),
        );
    });
});
