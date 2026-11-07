import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type ReadOptions, read, readFromMemory } from "../../src/index.js";
import { inputFiles, readOptions } from "./case-options.js";
import { suiteCases } from "../conformance/suite.js";

interface Example {
    name: string;
    files: Record<string, string>;
    entryFile: string;
    options: ReadOptions;
}

const casesFolder = join(import.meta.dirname, "cases");
const ownCases: Example[] = readdirSync(casesFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => {
        const expected = JSON.parse(readFileSync(join(casesFolder, name, "expected.json"), "utf8"));
        return {
            name,
            files: inputFiles(join(casesFolder, name, "input")),
            entryFile: expected.entry,
            options: readOptions(expected.options),
        };
    });
const validSuiteCases: Example[] = suiteCases
    .filter((each) => each.valid)
    .map(({ id, file, text }) => ({
        name: `suite: ${id}`,
        files: { [file]: text },
        entryFile: file,
        options: {},
    }));

const rereads = [...ownCases, ...validSuiteCases].flatMap((example) =>
    Object.keys(example.files).map((file) => ({ name: example.name, file, example })),
);

describe("a reread gives what a fresh read gives", () => {
    it.each(rereads)("$name, with $file emptied first", ({ file, example }) => {
        const { files, entryFile, options } = example;
        const fresh = readFromMemory({ files, entryFile }, options);
        const emptied = readFromMemory({ files: { ...files, [file]: "" }, entryFile }, options);
        const again = emptied.reread({ [file]: files[file] ?? "" });
        expect(JSON.parse(JSON.stringify(again))).toStrictEqual(JSON.parse(JSON.stringify(fresh)));
    });
});

describe("a reread of tokens from read", () => {
    const resolver = JSON.stringify({
        version: "2025.10",
        resolutionOrder: [{ type: "set", name: "base", sources: [{ $ref: "colors.json" }] }],
    });
    const onDisk: Record<string, string> = {
        "tokens.resolver.json": resolver,
        "colors.json": JSON.stringify({ blue: { $type: "number", $value: 1 } }),
    };
    const readText = (files: Record<string, string>) => async (path: string) => files[path];

    it("throws, naming a file the read never fetched", async () => {
        const emptied = await read("tokens.resolver.json", {
            readText: readText({ ...onDisk, "tokens.resolver.json": "" }),
        });
        expect(() => emptied.reread({ "tokens.resolver.json": resolver })).toThrow(
            "`colors.json` wasn't part of the last read: pass its text to `reread`, or read again",
        );
    });

    it("still finds a file missing that the read found missing", async () => {
        const tokens = await read("tokens.resolver.json", {
            readText: readText({ "tokens.resolver.json": resolver }),
        });
        const again = tokens.reread({ "tokens.resolver.json": `${resolver}\n` });
        expect(again.diagnostics.map((problem) => problem.kind)).toStrictEqual(["file-not-found"]);
    });

    it("reads a file the read fetched", async () => {
        const tokens = await read("tokens.resolver.json", { readText: readText(onDisk) });
        const again = tokens.reread({ "tokens.resolver.json": `${resolver}\n` });
        expect(again.getPermutation().getToken("blue")?.resolved).toBe(1);
    });
});
