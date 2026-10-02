import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { type Diagnostic, type Document, read, readFromMemory } from "../../src/index.js";

const repo = join(import.meta.dirname, "../../../..");

const tokenFolders = [
    "packages/core/tests/__fixtures__",
    "packages/cli/tests/__fixtures__",
    "packages/cli/tests/e2e/__fixtures__",
    "packages/studio/demo",
    "packages/studio/src/design-tokens",
    "apps/www/registry/tokens",
];

const notTokenFiles = ["packages/core/tests/__fixtures__/tokens/validators/"];

const readTogether = [
    [
        "packages/core/tests/__fixtures__/tokens/glob/a.json",
        "packages/core/tests/__fixtures__/tokens/glob/b.json",
    ],
];

interface AcceptSetEntry {
    entry: number;
    form: string;
    inRepo: boolean;
    matches: (d: Diagnostic) => boolean;
}

const acceptSet: AcceptSetEntry[] = [
    {
        entry: 1,
        form: "a hex-string colour",
        inRepo: true,
        matches: (d) => d.kind === "hex-string-color",
    },
    {
        entry: 2,
        form: "a hex field that is not six digits",
        inRepo: false,
        matches: (d) => reason(d) === "hex-not-six-digits",
    },
    {
        entry: 3,
        form: "a reference as part of a value",
        inRepo: false,
        matches: (d) => reason(d) === "alias-not-allowed-here",
    },
    {
        entry: 4,
        form: "an unknown property in a value",
        inRepo: false,
        matches: (d) => reason(d) === "unknown-property",
    },
    {
        entry: 5,
        form: "an empty font name",
        inRepo: false,
        matches: (d) => reason(d) === "not-a-font-name",
    },
    {
        entry: 6,
        form: "an empty font list",
        inRepo: false,
        matches: (d) => reason(d) === "empty-font-list",
    },
    {
        entry: 7,
        form: "a string in a dashArray that is not a reference",
        inRepo: false,
        matches: (d) => d.kind === "invalid-value" && d.detail.at.includes("dashArray"),
    },
    {
        entry: 8,
        form: "an empty dashArray",
        inRepo: false,
        matches: (d) => reason(d) === "empty-dash-array",
    },
    {
        entry: 9,
        form: "an empty shadow list",
        inRepo: false,
        matches: (d) => reason(d) === "no-shadows",
    },
    {
        entry: 10,
        form: "an empty gradient",
        inRepo: false,
        matches: (d) => reason(d) === "no-gradient-stops",
    },
    {
        entry: 11,
        form: "typography without all five parts",
        inRepo: true,
        matches: (d) =>
            d.kind === "invalid-value" &&
            d.detail.type === "typography" &&
            d.detail.reason === "missing-property",
    },
    {
        entry: 12,
        form: "a key written twice",
        inRepo: false,
        matches: (d) => d.kind === "duplicate-key",
    },
    {
        entry: 13,
        form: "a JSON Pointer index that is not plain digits",
        inRepo: false,
        matches: (d) => d.kind === "missing-reference" && /\/(?:0\d|\+|\d+\.)/.test(d.detail.ref),
    },
    {
        entry: 15,
        form: "a resolutionOrder $ref to something other than a set or modifier",
        inRepo: false,
        matches: (d) =>
            d.kind === "resolver-invalid" &&
            d.detail.rule === "invalid-pointer" &&
            d.detail.at[0] === "resolutionOrder",
    },
    {
        entry: 16,
        form: "$description, $deprecated or $extensions of the wrong JSON type",
        inRepo: false,
        matches: (d) =>
            d.kind === "invalid-property" &&
            ["$description", "$deprecated", "$extensions"].includes(d.detail.property),
    },
    {
        entry: 17,
        form: "a $root holding tokens",
        inRepo: false,
        matches: (d) => d.kind === "invalid-name" && d.detail.name === "$root",
    },
    {
        entry: 18,
        form: "$extends or $ref naming the group's own parent",
        inRepo: false,
        matches: (d) =>
            d.kind === "circular-reference" &&
            d.detail.chain.length === 2 &&
            (d.detail.chain[0] ?? "").startsWith(`${d.detail.chain[1] ?? ""}.`),
    },
    {
        entry: 19,
        form: "a reference to a token of another type",
        inRepo: false,
        matches: (d) => d.kind === "type-mismatch",
    },
];

interface Expected {
    project: string;
    why: string;
    matches: (d: Diagnostic) => boolean;
}

const expectedFailures: Expected[] = [
    {
        project: "packages/core/tests/__fixtures__/resolver/complex.resolver.json",
        why: "carries $extensions at its root, which old sugarcube's parser keeps and core's parse-resolver test checks; the Resolver module defines $extensions on sets and modifiers only, so dtcg warns (dtcg-spec-questions.md, R-2)",
        matches: (d) =>
            d.kind === "unknown-property" &&
            d.detail.property === "$extensions" &&
            d.detail.owner === "resolver",
    },
    {
        project: "packages/core/tests/__fixtures__/resolver/circular-a.resolver.json",
        why: "names circular-b, a resolver, as a token source, to test that it is refused",
        matches: (d) => d.kind === "resolver-invalid" && d.detail.rule === "resolver-as-source",
    },
    {
        project: "packages/core/tests/__fixtures__/resolver/invalid-reference.resolver.json",
        why: "refers to a set that does not exist, to test that it is refused",
        matches: (d) => d.kind === "resolver-invalid" && d.detail.rule === "unknown-set",
    },
    {
        project: "packages/core/tests/__fixtures__/resolver/invalid-source.resolver.json",
        why: "names a token file that does not exist, to test that it is refused",
        matches: (d) => d.kind === "file-not-found",
    },
    {
        project: "packages/core/tests/__fixtures__/resolver/invalid-structure.resolver.json",
        why: "holds a group member that is not a token or a group, to test that it is refused",
        matches: (d) => d.kind === "invalid-member",
    },
    {
        project: "packages/core/tests/__fixtures__/resolver/invalid-token.resolver.json",
        why: "holds a value of the wrong shape, to test that it is refused",
        matches: (d) => reason(d) === "wrong-shape",
    },
    {
        project: "packages/core/tests/__fixtures__/resolver/invalid-version.resolver.json",
        why: "has the wrong version, to test that it is refused",
        matches: (d) => d.kind === "resolver-invalid" && d.detail.rule === "version",
    },
    {
        project: "packages/core/tests/__fixtures__/resolver/single-context-modifier.resolver.json",
        why: "has a modifier with one context, which old sugarcube refuses too",
        matches: (d) => d.kind === "resolver-invalid" && d.detail.rule === "single-context",
    },
    {
        project: "packages/core/tests/__fixtures__/tokens/circular.resolver.json",
        why: "holds references that loop, to test that they are refused",
        matches: (d) => d.kind === "circular-reference",
    },
    {
        project: "packages/core/tests/__fixtures__/tokens/invalid-json.json",
        why: "is not valid JSON, to test that it is refused",
        matches: (d) => d.kind === "invalid-json",
    },
    {
        project: "packages/core/tests/__fixtures__/tokens/invalid-structure.json",
        why: "holds a group member that is not a token or a group, to test that it is refused",
        matches: (d) => d.kind === "invalid-member",
    },
    {
        project: "packages/core/tests/__fixtures__/tokens/invalid-token.json",
        why: "holds a value of the wrong shape, to test that it is refused",
        matches: (d) => reason(d) === "wrong-shape",
    },
    {
        project: "packages/cli/tests/__fixtures__/invalid-tokens.json",
        why: "has an unknown $type, to test that the CLI refuses it",
        matches: (d) => d.kind === "unknown-type",
    },
    {
        project: "packages/core/tests/__fixtures__/tokens/dark.json",
        why: "loaded by no test; refers to color.primary, which it does not define",
        matches: (d) => d.kind === "missing-reference" && d.detail.ref === "color.primary",
    },
    {
        project: "packages/core/tests/__fixtures__/tokens/theme-edge-cases.json",
        why: "loaded by no test; refers to color.nested.token, which it does not define",
        matches: (d) => d.kind === "missing-reference" && d.detail.ref === "color.nested.token",
    },
    {
        project: "packages/core/tests/__fixtures__/tokens/utilities.json",
        why: 'loaded by no test; writes dimensions as strings such as "1px", which old sugarcube refuses too',
        matches: (d) => reason(d) === "string-with-unit",
    },
    {
        project: "packages/studio/demo/tokens.resolver.json",
        why: "refers to size.step.*, made by sugarcube's scale recipe on size.step, which dtcg alone does not know; core's scale-parity test reads it with the generator and finds none missing",
        matches: (d) => d.kind === "missing-reference" && d.detail.ref.startsWith("size.step."),
    },
];

function reason(d: Diagnostic): string | undefined {
    return d.kind === "invalid-value" ? d.detail.reason : undefined;
}

function jsonFilesIn(folder: string): string[] {
    return readdirSync(join(repo, folder), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => relative(repo, join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
        .filter((file) => !notTokenFiles.some((prefix) => file.startsWith(prefix)))
        .sort();
}

const projects = new Map<string, Document>();

beforeAll(async () => {
    const files = tokenFolders.flatMap(jsonFilesIn);
    const covered = new Set<string>();
    for (const entry of files.filter((file) => file.endsWith(".resolver.json"))) {
        const doc = await read(entry, { readText: (path) => readFile(join(repo, path), "utf8") });
        for (const file of doc.files) covered.add(join(dirname(entry), file));
        projects.set(entry, doc);
    }
    for (const together of readTogether) {
        const texts = together.map((file) => [file, readFileSync(join(repo, file), "utf8")]);
        projects.set(together.join(" + "), readFromMemory({ files: Object.fromEntries(texts) }));
        for (const file of together) covered.add(file);
    }
    for (const file of files.filter(
        (each) => !each.endsWith(".resolver.json") && !covered.has(each),
    )) {
        const text = readFileSync(join(repo, file), "utf8");
        projects.set(file, readFromMemory({ files: { [file]: text } }));
    }
});

function located(d: Diagnostic): string {
    const where = d.at ? `${d.at.file}:${d.at.start.line}` : "no position";
    return `${d.kind} ${JSON.stringify(d.detail)} at ${where}`;
}

describe("every token file and resolver in the repo", () => {
    it("fails only with forms on old-accept-set.md, or where a fixture is meant to", () => {
        const unexplained = [...projects].flatMap(([project, doc]) =>
            doc.diagnostics
                .filter((d) => !acceptSet.some((each) => each.matches(d)))
                .filter(
                    (d) =>
                        !expectedFailures.some(
                            (each) => each.project === project && each.matches(d),
                        ),
                )
                .map((d) => `${project}: ${located(d)}`),
        );
        expect(unexplained).toStrictEqual([]);
    });

    it("still fails where a fixture is listed as failing", () => {
        const stale = expectedFailures
            .filter(
                ({ project, matches }) => !(projects.get(project)?.diagnostics ?? []).some(matches),
            )
            .map(({ project, why }) => `${project}: ${why}`);
        expect(stale).toStrictEqual([]);
    });

    it("finds exactly the accept-set entries old-accept-set.md says are in the repo", () => {
        const all = [...projects.values()].flatMap((doc) => doc.diagnostics);
        const found = acceptSet.map(({ entry, form, matches }) => ({
            entry,
            form,
            inRepo: all.some(matches),
        }));
        expect(found).toStrictEqual(
            acceptSet.map(({ entry, form, inRepo }) => ({ entry, form, inRepo })),
        );
    });
});
