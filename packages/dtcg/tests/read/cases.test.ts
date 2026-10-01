import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
    type Document,
    type Generator,
    type ReadOptions,
    defineGenerator,
    read,
    readFromMemory,
} from "../../src/index.js";
import { withSpans } from "./positions.js";

interface Expected {
    entry: string;
    spec?: string;
    options?: Pick<ReadOptions, "inputs" | "permutations" | "permutationLimit"> & {
        generators?: (keyof typeof generators)[];
    };
    files?: string[];
    modifiers?: Document["modifiers"];
    usedBy?: Document["usedBy"];
    permutations?: Partial<Document["permutations"][number]>[];
    graph?: Document["graph"];
    diagnostics: Pick<
        Document["diagnostics"][number],
        "kind" | "detail" | "at" | "related" | "path" | "permutation" | "fixes"
    >[];
}

const generators = {
    steps: defineGenerator({
        extension: ["com.example", "steps"],
        generate: (_group, steps) =>
            typeof steps === "number" && Number.isInteger(steps) && steps > 0
                ? {
                      ok: true,
                      value: Array.from({ length: steps }, (_, i) => ({
                          name: String(steps - i),
                          $value: { value: steps - i, unit: "rem" },
                      })),
                  }
                : {
                      ok: false,
                      errors: [
                          {
                              kind: "invalid-value",
                              path: [],
                              message: "steps must be a whole number above 0",
                              detail: "not-a-positive-integer",
                          },
                      ],
                  },
    }),
    ramp: defineGenerator({
        extension: ["com.example", "ramp"],
        generate: (_group, ramp) => {
            const count = (ramp as { count?: unknown }).count;
            return typeof count === "number"
                ? {
                      ok: true,
                      value: Array.from({ length: count }, (_, i) => ({
                          name: String(i + 1),
                          $value: { value: i + 1, unit: "px" },
                      })),
                  }
                : {
                      ok: false,
                      errors: [
                          {
                              kind: "invalid-value",
                              path: ["count"],
                              message: "count must be a number",
                              detail: "not-a-number",
                          },
                      ],
                  };
        },
    }),
} satisfies Record<string, Generator>;

function readOptions(expected: Expected): ReadOptions {
    const { generators: names, ...options } = expected.options ?? {};
    return { ...options, ...(names && { generators: names.map((name) => generators[name]) }) };
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
        ...(expected.graph && { graph: doc.graph }),
        ...(expected.permutations && {
            permutations: doc.permutations.map((permutation, index) =>
                observedPermutation(permutation, expected.permutations?.[index]),
            ),
        }),
        diagnostics: doc.diagnostics.map(
            ({ kind, detail, at, related, path, permutation, fixes }) => ({
                kind,
                detail,
                ...(at && { at }),
                ...(related && { related }),
                ...(path !== undefined && { path }),
                ...(permutation !== undefined && { permutation }),
                ...(fixes && { fixes }),
            }),
        ),
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
            ...readOptions(expected),
            readText: (path) => readFile(join(input, path), "utf8"),
        });
        expect(observed(doc, expected)).toStrictEqual(expected);
    });

    it("reads through readFromMemory", () => {
        const doc = readFromMemory(
            { files: inputFiles(input), entry: expected.entry },
            readOptions(expected),
        );
        expect(observed(doc, expected)).toStrictEqual(expected);
    });
});
