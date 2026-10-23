import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type DesignTokens, type Permutation, read, readFromMemory } from "../../src/index.js";
import { type CaseOptions, inputFiles, readOptions } from "./case-options.js";
import { textIn } from "./on-disk.js";
import { withSpans } from "./positions.js";

interface Expected {
    entry: string;
    spec?: string;
    options?: CaseOptions;
    files?: string[];
    sources?: unknown[];
    resolver?: DesignTokens["resolver"];
    permutations?: Partial<DesignTokens["permutations"][number]>[];
    diagnostics: Pick<
        DesignTokens["diagnostics"][number],
        "kind" | "detail" | "span" | "related" | "path" | "permutations"
    >[];
}

const casesFolder = join(import.meta.dirname, "cases");
const cases = readdirSync(casesFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

function observed(found: DesignTokens, expected: Expected) {
    const tokens: DesignTokens = JSON.parse(JSON.stringify(found));
    found.permutations.forEach((permutation, index) => {
        const written = tokens.permutations[index];
        if (written) placedIn(found, permutation, written);
    });
    return {
        entry: expected.entry,
        spec: expected.spec,
        ...(expected.options && { options: expected.options }),
        ...(expected.files && { files: tokens.files }),
        ...(expected.sources && { sources: tokens.sources }),
        ...(expected.resolver && { resolver: tokens.resolver }),
        ...(expected.permutations && {
            permutations: tokens.permutations.map((permutation, index) =>
                observedPermutation(permutation, expected.permutations?.[index]),
            ),
        }),
        diagnostics: tokens.diagnostics.map(
            ({ kind, detail, span, related, path, permutations }) => ({
                kind,
                detail,
                ...(span && { span }),
                ...(related && { related }),
                ...(path !== undefined && { path }),
                ...(permutations.length > 0 &&
                    permutations.length < tokens.permutations.length && { permutations }),
            }),
        ),
    };
}

type Positioned = { writtenAt: { span?: unknown }[]; references: { span?: unknown }[] };

function placedIn(found: DesignTokens, permutation: Permutation, written: Permutation): void {
    const live = [...permutation.tokens, ...permutation.groups];
    const plain = [...written.tokens, ...written.groups] as unknown as Positioned[];
    live.forEach((each, index) => {
        const into = plain[index];
        if (!into) return;
        each.writtenAt.forEach((place, at) => {
            const json = into.writtenAt[at];
            if (json) json.span = found.spanOf(place);
        });
        each.references.forEach((reference, at) => {
            const json = into.references[at];
            if (json) json.span = found.spanOf(reference);
        });
    });
}

function observedPermutation(
    permutation: DesignTokens["permutations"][number],
    expected: Partial<DesignTokens["permutations"][number]> = {},
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

function picked<T extends { path: string }>(found: readonly T[], wanted: readonly Partial<T>[]) {
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
        const tokens = await read(expected.entry, {
            ...readOptions(expected.options),
            readText: textIn(input),
        });
        expect(observed(tokens, expected)).toStrictEqual(expected);
    });

    it("reads through readFromMemory", () => {
        const tokens = readFromMemory(
            { files: inputFiles(input), entry: expected.entry },
            readOptions(expected.options),
        );
        expect(observed(tokens, expected)).toStrictEqual(expected);
    });

    it("names each problem's permutations among those that read its file", () => {
        const tokens = readFromMemory(
            { files: inputFiles(input), entry: expected.entry },
            readOptions(expected.options),
        );
        const reads = (permutation: Permutation, file: string) =>
            permutation.sources.some((source) => source.file === file);
        const misplaced = tokens.diagnostics.flatMap((problem) => {
            const file = problem.span?.file;
            if (file === undefined) return [];
            const fits =
                file === tokens.entry
                    ? problem.permutations.length === tokens.permutations.length
                    : problem.permutations.every((each) => reads(each, file));
            return fits ? [] : [`${problem.kind} in ${file}`];
        });
        expect(misplaced).toStrictEqual([]);
    });

    it("names a value's problem in exactly the permutations whose token takes that value", () => {
        const tokens = readFromMemory(
            { files: inputFiles(input), entry: expected.entry },
            readOptions(expected.options),
        );
        const inValue = (problem: DesignTokens["diagnostics"][number]) =>
            problem.kind === "invalid-value" ||
            problem.kind === "hex-string-color" ||
            (problem.kind === "unknown-property" &&
                "jsonPath" in problem.detail &&
                problem.detail.jsonPath[0] === "$value");
        const misplaced = tokens.diagnostics.flatMap((problem) => {
            const { path, span } = problem;
            if (!inValue(problem) || path === undefined || span === undefined) return [];
            if (!tokens.permutations.some((each) => each.token(path))) return [];
            const takes = (permutation: Permutation) => {
                const winner = permutation.token(path)?.valueFrom;
                const from = winner && tokens.spanOf(winner);
                return (
                    from !== undefined &&
                    from.file === span.file &&
                    from.offset <= span.offset &&
                    span.offset + span.length <= from.offset + from.length
                );
            };
            const named = problem.permutations ?? tokens.permutations;
            const taking = tokens.permutations.filter(takes);
            const exact =
                named.length === taking.length && named.every((each) => taking.includes(each));
            return exact ? [] : [`${problem.kind} at ${path}`];
        });
        expect(misplaced).toStrictEqual([]);
    });
});
