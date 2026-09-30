import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { type Document, type ReadOptions, read, readFromMemory } from "../../src/index.js";
import { withSpans } from "./positions.js";

interface Expected {
    entry: string;
    spec?: string;
    options?: Pick<ReadOptions, "inputs" | "permutations" | "permutationLimit">;
    files?: string[];
    modifiers?: Document["modifiers"];
    usedBy?: Document["usedBy"];
    permutations?: Partial<Document["permutations"][number]>[];
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
        ...(expected.options && { options: expected.options }),
        ...(expected.files && { files: doc.files }),
        ...(expected.modifiers && { modifiers: doc.modifiers }),
        ...(expected.usedBy && { usedBy: doc.usedBy }),
        ...(expected.permutations && {
            permutations: doc.permutations.map((permutation, index) =>
                observedPermutation(permutation, expected.permutations?.[index]),
            ),
        }),
        diagnostics: doc.diagnostics.map(({ kind, detail, at, related }) => ({
            kind,
            detail,
            ...(at && { at }),
            ...(related && { related }),
        })),
    };
}

function observedPermutation(
    permutation: Document["permutations"][number],
    expected: Partial<Document["permutations"][number]> = {},
) {
    const { input, label, sources, tokens, groups } = permutation;
    return {
        ...(!expected.tokens && !expected.groups && { input, label, sources }),
        ...("input" in expected && { input }),
        ...("label" in expected && { label }),
        ...("sources" in expected && { sources }),
        ...(expected.tokens && { tokens: picked(tokens, expected.tokens) }),
        ...(expected.groups && { groups: picked(groups, expected.groups) }),
    };
}

function picked<T extends object>(found: Record<string, T>, wanted: Record<string, Partial<T>>) {
    return Object.fromEntries(
        Object.entries(found).map(([path, each]) => {
            const keys = Object.keys(wanted[path] ?? each);
            return [
                path,
                Object.fromEntries(Object.entries(each).filter(([key]) => keys.includes(key))),
            ];
        }),
    );
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
            ...expected.options,
            readText: (path) => readFile(join(input, path), "utf8"),
        });
        expect(observed(doc, expected)).toStrictEqual(expected);
    });

    it("reads through readFromMemory", () => {
        const doc = readFromMemory(
            { files: inputFiles(input), entry: expected.entry },
            expected.options,
        );
        expect(observed(doc, expected)).toStrictEqual(expected);
    });
});
