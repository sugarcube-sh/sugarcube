import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type DesignTokens, type Permutation, readFromMemory } from "../../src/index.js";
import { read } from "../../src/node.js";
import { type CaseOptions, loadCases, readOptions } from "./case-options.js";
import { withSpans } from "./positions.js";
import { getSpan } from "../../src/editor.js";

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
        "kind" | "detail" | "span" | "relatedInformation" | "path" | "permutations"
    >[];
}

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
            ({ kind, detail, span, relatedInformation, path, permutations }) => ({
                kind,
                detail,
                ...(span && { span }),
                ...(relatedInformation && { relatedInformation }),
                ...(path !== undefined && { path }),
                ...(permutations.length > 0 &&
                    permutations.length < tokens.permutations.length && { permutations }),
            }),
        ),
    };
}

type Positioned = { definitions: { span?: unknown }[]; references: { span?: unknown }[] };

function placedIn(found: DesignTokens, permutation: Permutation, written: Permutation): void {
    const live = [...permutation.tokens, ...permutation.groups];
    const plain = [...written.tokens, ...written.groups] as unknown as Positioned[];
    live.forEach((each, index) => {
        const into = plain[index];
        if (!into) return;
        each.definitions.forEach((place, at) => {
            const json = into.definitions[at];
            if (json) json.span = getSpan(found, place);
        });
        each.references.forEach((reference, at) => {
            const json = into.references[at];
            if (json) json.span = getSpan(found, reference);
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

for (const { name, input, files, expected: written } of loadCases()) {
    describe(name, () => {
        const expected = withSpans(written, files) as Expected;
        const fromMemory = () =>
            readFromMemory({ files, entryFile: expected.entry }, readOptions(expected.options));

        it("reads through read", async () => {
            const tokens = await read(join(input, expected.entry), readOptions(expected.options));
            expect(observed(tokens, expected)).toStrictEqual(expected);
        });

        it("reads through readFromMemory", () => {
            const tokens = fromMemory();
            expect(observed(tokens, expected)).toStrictEqual(expected);
        });

        it("names each problem's permutations among those that read its file", () => {
            const tokens = fromMemory();
            const reads = (permutation: Permutation, file: string) =>
                permutation.sources.some((source) => source.file === file);
            const misplaced = tokens.diagnostics.flatMap((problem) => {
                const file = problem.span?.file;
                if (file === undefined) return [];
                const fits =
                    file === tokens.entryFile
                        ? problem.permutations.length === tokens.permutations.length
                        : problem.permutations.every((each) => reads(each, file));
                return fits ? [] : [`${problem.kind} in ${file}`];
            });
            expect(misplaced).toStrictEqual([]);
        });

        it("names a value's problem in exactly the permutations whose token takes that value", () => {
            const tokens = fromMemory();
            const inValue = (problem: DesignTokens["diagnostics"][number]) =>
                problem.kind === "invalid-value" ||
                problem.kind === "hex-string-color" ||
                (problem.kind === "unknown-property" &&
                    "jsonPath" in problem.detail &&
                    problem.detail.jsonPath[0] === "$value");
            const misplaced = tokens.diagnostics.flatMap((problem) => {
                const { path, span } = problem;
                if (!inValue(problem) || path === undefined || span === undefined) return [];
                if (!tokens.permutations.some((each) => each.getToken(path))) return [];
                const takes = (permutation: Permutation) => {
                    const winner = permutation.getToken(path)?.winningDefinition;
                    const from = winner && getSpan(tokens, winner);
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
}
