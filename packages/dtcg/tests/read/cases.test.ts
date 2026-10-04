import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
    type Document,
    type ExtensionValidator,
    type Generator,
    type ReadOptions,
    type StandardSchemaV1,
    defineExtensionValidator,
    defineGenerator,
    read,
    readFromMemory,
} from "../../src/index.js";
import { parseValue } from "../../src/values.js";
import { withSpans } from "./positions.js";

interface Expected {
    entry: string;
    spec?: string;
    options?: Pick<
        ReadOptions,
        "inputs" | "permutations" | "permutationLimit" | "hexStringColors"
    > & {
        generators?: (keyof typeof generators)[];
        extensionValidators?: (keyof typeof validators)[];
    };
    files?: string[];
    modifiers?: Document["modifiers"];
    usedBy?: Document["usedBy"];
    permutations?: Partial<Document["permutations"][number]>[];
    diagnostics: Pick<
        Document["diagnostics"][number],
        "kind" | "detail" | "at" | "related" | "path" | "permutation" | "fixes"
    >[];
}

function schema<Output>(
    validate: (value: unknown) => StandardSchemaV1.Result<Output>,
): StandardSchemaV1<unknown, Output> {
    return { "~standard": { version: 1, vendor: "test", validate } };
}

const countSchema = schema<{ count: number }>((value) => {
    const count = Number((value as { count?: unknown }).count);
    return Number.isInteger(count)
        ? { value: { count } }
        : { issues: [{ message: "Expected a whole number", path: [{ key: "count" }] }] };
});

const fluidSchema = schema<{ fluid: boolean }>((value) => {
    const { fluid } = value as { fluid?: unknown };
    return typeof fluid === "boolean"
        ? { value: { fluid } }
        : { issues: [{ message: "Expected boolean", path: [{ key: "fluid" }] }] };
});

const generators = {
    steps: defineGenerator({
        extension: ["com.example", "steps"],
        messages: {
            "not-a-count": ({ steps }: { steps: unknown }) =>
                `\`steps\` must be a whole number above 0, not ${JSON.stringify(steps)}`,
        },
        generate: (_group, steps) =>
            typeof steps === "number" && Number.isInteger(steps) && steps > 0
                ? {
                      ok: true,
                      value: Array.from({ length: steps }, (_, i) => ({
                          name: String(steps - i),
                          $value: { value: steps - i, unit: "rem" },
                      })),
                  }
                : { ok: false, errors: [{ path: [], reason: "not-a-count", data: { steps } }] },
    }),
    ramp: defineGenerator({
        extension: ["com.example", "ramp"],
        messages: {
            "count-not-a-number": ({ count }: { count: unknown }) =>
                `\`count\` must be a number, not ${JSON.stringify(count)}`,
        },
        generate: (_group, ramp) => {
            const { count, size, color } = ramp as {
                count?: unknown;
                size?: unknown;
                color?: unknown;
            };
            if (size !== undefined) {
                const parsed = parseValue("dimension", size, ["size"], { references: false });
                if (!parsed.ok) return parsed;
            }
            if (color !== undefined) {
                const parsed = parseValue("color", color, ["color"], { references: false });
                if (!parsed.ok) return parsed;
            }
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
                      errors: [{ path: ["count"], reason: "count-not-a-number", data: { count } }],
                  };
        },
    }),
    counted: defineGenerator({
        extension: ["com.example", "counted"],
        schema: countSchema,
        generate: (_group, { count }) => ({
            ok: true,
            value: Array.from({ length: count }, (_, i) => ({
                name: String(i + 1),
                $value: { value: i + 1, unit: "px" },
            })),
        }),
    }),
} satisfies Record<string, Generator>;

const validators = {
    fluid: defineExtensionValidator({
        key: "com.example",
        appliesTo: ["dimension", "group"],
        schema: fluidSchema,
    }),
    outline: defineExtensionValidator({
        key: "com.example",
        appliesTo: ["color"],
        messages: { "no-outline": () => "`outline` is missing" },
        validate: (_token, extension) => {
            const { outline } = extension as { outline?: unknown };
            if (outline === undefined) return [{ path: [], reason: "no-outline" }];
            const parsed = parseValue("dimension", outline, ["outline"], { references: false });
            return parsed.ok ? [] : parsed.errors;
        },
    }),
    symbolPath: defineExtensionValidator({
        key: "com.example",
        appliesTo: ["number"],
        schema: schema(() => ({
            issues: [{ message: "Not allowed", path: [{ key: "a" }, 0, Symbol("b"), "c"] }],
        })),
    }),
} satisfies Record<string, ExtensionValidator>;

function readOptions(expected: Expected): ReadOptions {
    const { generators: names, extensionValidators: checks, ...options } = expected.options ?? {};
    return {
        ...options,
        ...(names && { generators: names.map((name) => generators[name]) }),
        ...(checks && { extensionValidators: checks.map((name) => validators[name]) }),
    };
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
