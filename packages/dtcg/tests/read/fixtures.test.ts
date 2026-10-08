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

const mistakesTheCLIShows = ["packages/cli/tests/__fixtures__/mistakes/"];

const readTogether = [
    [
        "packages/core/tests/__fixtures__/tokens/glob/a.json",
        "packages/core/tests/__fixtures__/tokens/glob/b.json",
    ],
];

interface OldForm {
    form: string;
    inRepo: boolean;
    matches: (d: Diagnostic) => boolean;
}

const oldForms: OldForm[] = [
    {
        form: "a hex-string colour",
        inRepo: true,
        matches: (d) => d.kind === "hex-string-color",
    },
    {
        form: "a hex field that is not six digits",
        inRepo: false,
        matches: (d) => reason(d) === "hex-not-six-digits",
    },
    {
        form: "a reference as part of a value",
        inRepo: false,
        matches: (d) => reason(d) === "alias-not-allowed-here",
    },
    {
        form: "an unknown property in a value",
        inRepo: false,
        matches: (d) => reason(d) === "unknown-property",
    },
    {
        form: "an empty font name",
        inRepo: false,
        matches: (d) => reason(d) === "not-a-font-name",
    },
    {
        form: "an empty font list",
        inRepo: false,
        matches: (d) => reason(d) === "empty-font-list",
    },
    {
        form: "a string in a dashArray that is not a reference",
        inRepo: false,
        matches: (d) => d.kind === "invalid-value" && d.detail.at.includes("dashArray"),
    },
    {
        form: "an empty dashArray",
        inRepo: false,
        matches: (d) => reason(d) === "empty-dash-array",
    },
    {
        form: "an empty shadow list",
        inRepo: false,
        matches: (d) => reason(d) === "no-shadows",
    },
    {
        form: "an empty gradient",
        inRepo: false,
        matches: (d) => reason(d) === "no-gradient-stops",
    },
    {
        form: "typography without all five parts",
        inRepo: true,
        matches: (d) =>
            d.kind === "invalid-value" &&
            d.detail.type === "typography" &&
            d.detail.reason === "missing-property",
    },
    {
        form: "a key written twice",
        inRepo: false,
        matches: (d) => d.kind === "duplicate-key",
    },
    {
        form: "a file named in resolutionOrder",
        inRepo: false,
        matches: (d) =>
            d.kind === "resolver-invalid" && d.detail.rule === "file-in-resolution-order",
    },
    {
        form: "$description, $deprecated or $extensions of the wrong JSON type",
        inRepo: false,
        matches: (d) =>
            d.kind === "invalid-property" &&
            ["$description", "$deprecated", "$extensions"].includes(d.detail.property),
    },
    {
        form: "a $root holding tokens",
        inRepo: false,
        matches: (d) => d.kind === "invalid-name" && d.detail.name === "$root",
    },
    {
        form: "$extends or $ref naming the group's own parent",
        inRepo: false,
        matches: (d) =>
            d.kind === "circular-reference" &&
            d.detail.chain.length === 2 &&
            (d.detail.chain[0] ?? "").startsWith(`${d.detail.chain[1] ?? ""}.`),
    },
    {
        form: "a reference to a token of another type",
        inRepo: false,
        matches: (d) => d.kind === "type-mismatch",
    },
    {
        form: "a list as a group member",
        inRepo: false,
        matches: (d) => d.kind === "invalid-member" && d.detail.found === "array",
    },
    {
        form: "$extends without braces, or a group $extends or $ref that is not a reference",
        inRepo: false,
        matches: (d) =>
            d.kind === "invalid-property" && ["$extends", "$ref"].includes(d.detail.property),
    },
    {
        form: "bad keys beside a $ref in resolutionOrder",
        inRepo: false,
        matches: (d) =>
            d.kind === "resolver-invalid" &&
            d.detail.at[0] === "resolutionOrder" &&
            ["invalid-default", "wrong-type", "no-contexts"].includes(d.detail.rule),
    },
    {
        form: "a source whose $ref is not a string",
        inRepo: false,
        matches: (d) =>
            d.kind === "resolver-invalid" &&
            d.detail.rule === "wrong-type" &&
            d.detail.name === "$ref" &&
            d.detail.at.includes("sources"),
    },
    {
        form: "a token file whose top level is a list",
        inRepo: false,
        matches: (d) => d.kind === "invalid-json" && d.detail.reason === "not-an-object",
    },
    {
        form: "a $ref that is not a JSON Pointer",
        inRepo: false,
        matches: (d) => d.kind === "malformed-pointer",
    },
    {
        form: "a modifier listed twice in resolutionOrder",
        inRepo: false,
        matches: (d) => d.kind === "resolver-invalid" && d.detail.rule === "duplicate-name",
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
        why: "carries $extensions at its root, which old sugarcube's parser keeps and core's parse-resolver test checks; the Resolver module defines $extensions on sets and modifiers only, so dtcg warns",
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
        why: "writes `value` for `$value`, to test that it is refused",
        matches: (d) => d.kind === "misspelt-property",
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
        why: "writes `value` for `$value`, to test that it is refused",
        matches: (d) => d.kind === "misspelt-property",
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
        .filter(
            (file) =>
                ![...notTokenFiles, ...mistakesTheCLIShows].some((prefix) =>
                    file.startsWith(prefix),
                ),
        )
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
    it("fails only with forms old sugarcube accepted, or where a fixture is meant to", () => {
        const unexplained = [...projects].flatMap(([project, doc]) =>
            doc.diagnostics
                .filter((d) => !oldForms.some((each) => each.matches(d)))
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

    it("finds in the repo exactly the forms old sugarcube accepted that are marked as there", () => {
        const all = [...projects.values()].flatMap((doc) => doc.diagnostics);
        const found = oldForms.map(({ form, matches }) => ({
            form,
            inRepo: all.some(matches),
        }));
        expect(found).toStrictEqual(oldForms.map(({ form, inRepo }) => ({ form, inRepo })));
    });
});
