import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { type Diagnostic, type DesignTokens, readFromMemory } from "../../src/index.js";
import { read } from "../../src/node.js";

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

const kindIs =
    (kind: Diagnostic["kind"]) =>
    (d: Diagnostic): boolean =>
        d.kind === kind;

const reasonIs =
    (expected: string) =>
    (d: Diagnostic): boolean =>
        reason(d) === expected;

const ruleIs =
    (rule: string) =>
    (d: Diagnostic): boolean =>
        d.kind === "resolver-invalid" && d.detail.rule === rule;

const oldForms: Record<string, (d: Diagnostic) => boolean> = {
    "a hex-string colour": kindIs("hex-string-color"),
    "a hex field that is not six digits": reasonIs("hex-not-six-digits"),
    "a reference as part of a value": reasonIs("curly-brace-not-allowed-here"),
    "an unknown property in a value": reasonIs("unknown-property"),
    "an empty font name": reasonIs("not-a-font-name"),
    "an empty font list": reasonIs("empty-font-list"),
    "a string in a dashArray that is not a reference": (d) =>
        d.kind === "invalid-value" && d.detail.jsonPath.includes("dashArray"),
    "an empty dashArray": reasonIs("empty-dash-array"),
    "an empty shadow list": reasonIs("no-shadows"),
    "an empty gradient": reasonIs("no-gradient-stops"),
    "typography without all five parts": (d) =>
        d.kind === "invalid-value" &&
        d.detail.type === "typography" &&
        d.detail.reason === "missing-property",
    "a key written twice": kindIs("duplicate-key"),
    "a file named in resolutionOrder": ruleIs("file-in-resolution-order"),
    "$description, $deprecated or $extensions of the wrong JSON type": (d) =>
        d.kind === "invalid-property" &&
        ["$description", "$deprecated", "$extensions"].includes(d.detail.property),
    "a $root holding tokens": (d) => d.kind === "invalid-name" && d.detail.name === "$root",
    "$extends or $ref naming the group's own parent": (d) =>
        d.kind === "circular-reference" &&
        d.detail.chain.length === 2 &&
        (d.detail.chain[0] ?? "").startsWith(`${d.detail.chain[1] ?? ""}.`),
    "a reference to a token of another type": kindIs("type-mismatch"),
    "a list as a group member": (d) => d.kind === "invalid-member" && d.detail.found === "array",
    "$extends without braces, or a group $extends or $ref that is not a reference": (d) =>
        d.kind === "invalid-property" && ["$extends", "$ref"].includes(d.detail.property),
    "bad keys beside a $ref in resolutionOrder": (d) =>
        d.kind === "resolver-invalid" &&
        d.detail.jsonPath[0] === "resolutionOrder" &&
        ["invalid-default", "wrong-type", "no-contexts"].includes(d.detail.rule),
    "a source whose $ref is not a string": (d) =>
        d.kind === "resolver-invalid" &&
        d.detail.rule === "wrong-type" &&
        d.detail.name === "$ref" &&
        d.detail.jsonPath.includes("sources"),
    "a token file whose top level is a list": (d) =>
        d.kind === "invalid-json" && d.detail.reason === "not-an-object",
    "a $ref that is not a JSON Pointer": kindIs("malformed-pointer"),
    "a modifier listed twice in resolutionOrder": ruleIs("duplicate-name"),
};

const oldFormsInRepo = ["a hex-string colour", "typography without all five parts"];

interface Expected {
    project: string;
    why: string;
    matches: (d: Diagnostic) => boolean;
}

const expectedFailures: Expected[] = [
    {
        project: "packages/core/tests/__fixtures__/resolver/complex.resolver.json",
        why: "carries $extensions at its root, which old sugarcube's parser kept; the Resolver module defines $extensions on sets and modifiers only (4.3), so it is a property the spec does not define",
        matches: (d) =>
            d.kind === "unknown-property" &&
            d.detail.property === "$extensions" &&
            "owner" in d.detail &&
            d.detail.owner === "resolver",
    },
    {
        project: "packages/core/tests/__fixtures__/resolver/circular-b.resolver.json",
        why: "declares a set the target circular-a points at, which its own resolutionOrder leaves out; nothing reaches the set, so it takes no part (Resolver 4.1.6) and is reported as a hint",
        matches: (d) => d.kind === "not-in-resolution-order" && d.detail.name === "b",
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

const projects = new Map<string, DesignTokens>();

beforeAll(async () => {
    const files = tokenFolders.flatMap(jsonFilesIn);
    const covered = new Set<string>();
    for (const entry of files.filter((file) => file.endsWith(".resolver.json"))) {
        const tokens = await read(join(repo, entry));
        for (const file of tokens.files) covered.add(join(dirname(entry), file));
        projects.set(entry, tokens);
    }
    for (const together of readTogether) {
        const texts = together.map((file) => [file, readFileSync(join(repo, file), "utf8")]);
        const sources = together.map((file) => ({
            $ref: `./${relative(dirname(together[0] ?? ""), file)}`,
        }));
        const entryFile = join(dirname(together[0] ?? ""), "together.resolver.json");
        const resolver = JSON.stringify({
            version: "2025.10",
            resolutionOrder: [{ type: "set", name: "together", sources }],
        });
        const withResolver = Object.fromEntries([...texts, [entryFile, resolver]]);
        projects.set(together.join(" + "), readFromMemory({ files: withResolver, entryFile }));
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
    const where = d.span ? `${d.span.file}:${d.span.start.line}` : "no position";
    return `${d.kind} ${JSON.stringify(d.detail)} at ${where}`;
}

describe("every token file and resolver in the repo", () => {
    it("fails only with forms old sugarcube accepted, or where a fixture is meant to", () => {
        const unexplained = [...projects].flatMap(([project, tokens]) =>
            tokens.diagnostics
                .filter((d) => !Object.values(oldForms).some((matches) => matches(d)))
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
        const all = [...projects.values()].flatMap((tokens) => tokens.diagnostics);
        expect(
            Object.entries(oldForms)
                .filter(([, matches]) => all.some(matches))
                .map(([form]) => form),
        ).toStrictEqual(oldFormsInRepo);
    });
});
