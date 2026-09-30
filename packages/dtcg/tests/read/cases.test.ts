import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { type Document, read, readFromMemory } from "../../src/index.js";

interface Expected {
    entry: string;
    spec?: string;
    files?: string[];
    modifiers?: Document["modifiers"];
    readers?: Document["readers"];
    permutations?: Pick<Document["permutations"][number], "input" | "label" | "sets">[];
    diagnostics: Pick<Document["diagnostics"][number], "kind" | "detail" | "at" | "related">[];
}

const casesFolder = join(import.meta.dirname, "cases");
const cases = readdirSync(casesFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

function inputFiles(folder: string): Record<string, string> {
    if (!existsSync(folder)) return {};
    return Object.fromEntries(
        readdirSync(folder, { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => {
                const path = join(entry.parentPath, entry.name);
                return [relative(folder, path).replaceAll("\\", "/"), readFileSync(path, "utf8")];
            }),
    );
}

function observed(doc: Document, expected: Expected) {
    return {
        entry: expected.entry,
        spec: expected.spec,
        ...(expected.files && { files: doc.files }),
        ...(expected.modifiers && { modifiers: doc.modifiers }),
        ...(expected.readers && { readers: doc.readers }),
        ...(expected.permutations && {
            permutations: doc.permutations.map(({ input, label, sets }) => ({
                input,
                label,
                sets,
            })),
        }),
        diagnostics: doc.diagnostics.map(({ kind, detail, at, related }) => ({
            kind,
            detail,
            ...(at && { at }),
            ...(related && { related }),
        })),
    };
}

describe.each(cases)("%s", (name) => {
    const folder = join(casesFolder, name);
    const expected = JSON.parse(readFileSync(join(folder, "expected.json"), "utf8")) as Expected;
    const input = join(folder, "input");

    it("reads through read", async () => {
        const doc = await read(expected.entry, {
            readText: (path) => readFile(join(input, path), "utf8"),
        });
        expect(observed(doc, expected)).toStrictEqual(expected);
    });

    it("reads through readFromMemory", () => {
        const doc = readFromMemory({ files: inputFiles(input), entry: expected.entry });
        expect(observed(doc, expected)).toStrictEqual(expected);
    });
});
