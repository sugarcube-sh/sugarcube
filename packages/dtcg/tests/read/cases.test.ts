import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Document, read, readFromMemory } from "../../src/index.js";
import { type CaseOptions, inputFiles, readOptions } from "./case-options.js";
import { withSpans } from "./positions.js";

interface Expected {
    entry: string;
    spec?: string;
    options?: CaseOptions;
    files?: string[];
    modifiers?: Document["modifiers"];
    usedBy?: Document["usedBy"];
    permutations?: Partial<Document["permutations"][number]>[];
    diagnostics: Pick<
        Document["diagnostics"][number],
        "kind" | "detail" | "at" | "related" | "path" | "permutation"
    >[];
}

const casesFolder = join(import.meta.dirname, "cases");
const cases = readdirSync(casesFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

function observed(doc: Document, expected: Expected) {
    return {
        entry: expected.entry,
        spec: expected.spec,
        ...(expected.options && { options: expected.options }),
        ...(expected.files && { files: doc.files }),
        ...(expected.modifiers && { modifiers: doc.modifiers }),
        ...(expected.usedBy && { usedBy: doc.usedBy }),
        ...(expected.permutations && {
            permutations: doc.permutations.map((permutation, index) =>
                observedPermutation(permutation, expected.permutations?.[index]),
            ),
        }),
        diagnostics: doc.diagnostics.map(({ kind, detail, at, related, path, permutation }) => ({
            kind,
            detail,
            ...(at && { at }),
            ...(related && { related }),
            ...(path !== undefined && { path }),
            ...(permutation !== undefined && { permutation }),
        })),
    };
}

function observedPermutation(
    permutation: Document["permutations"][number],
    expected: Partial<Document["permutations"][number]> = {},
) {
    const { input, label, sources, tokens, groups, edges } = permutation;
    return {
        ...(!expected.tokens && !expected.groups && !expected.edges && { input, label, sources }),
        ...("input" in expected && { input }),
        ...("label" in expected && { label }),
        ...("sources" in expected && { sources }),
        ...(expected.tokens && { tokens: picked(tokens, expected.tokens) }),
        ...(expected.groups && { groups: picked(groups, expected.groups) }),
        ...(expected.edges && { edges }),
    };
}

function picked<T extends { path: string }>(found: T[], wanted: Partial<T>[]) {
    return found.map((each) => {
        const expected: Record<string, unknown> =
            wanted.find((one) => one.path === each.path) ?? each;
        const present = Object.entries(each).filter(([key]) => key in expected);
        const absent = Object.keys(expected)
            .filter((key) => expected[key] === null && !(key in each))
            .map((key) => [key, null]);
        return Object.fromEntries([...present, ...absent]);
    });
}

describe.each(cases)("%s", (name) => {
    const folder = join(casesFolder, name);
    const input = join(folder, "input");
    const expected = withSpans(
        JSON.parse(readFileSync(join(folder, "expected.json"), "utf8")),
        inputFiles(input),
    ) as Expected;

    it("reads through read", async () => {
        const doc = await read(expected.entry, {
            ...readOptions(expected.options),
            readText: (path) => readFile(join(input, path), "utf8"),
        });
        expect(observed(doc, expected)).toStrictEqual(expected);
    });

    it("reads through readFromMemory", () => {
        const doc = readFromMemory(
            { files: inputFiles(input), entry: expected.entry },
            readOptions(expected.options),
        );
        expect(observed(doc, expected)).toStrictEqual(expected);
    });
});
