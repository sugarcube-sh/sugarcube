import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAbsoluteFilePath, read } from "../../src/node.js";

const folder = join(import.meta.dirname, "../read/cases/every-combination/input");

describe("getAbsoluteFilePath", () => {
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
