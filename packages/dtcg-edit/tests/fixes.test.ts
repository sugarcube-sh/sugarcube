import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type DesignTokens, type Diagnostic, type Span, read } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { inputFiles, readOptions } from "../../dtcg/tests/read/case-options.js";
import { textIn } from "../../dtcg/tests/read/on-disk.js";
import { withSpans } from "../../dtcg/tests/read/positions.js";
import { type Fix, fixesFor } from "../src/index.js";

const casesFolder = join(import.meta.dirname, "../../dtcg/tests/read/cases");
const expectedFolder = join(import.meta.dirname, "fixes");
const cases = readdirSync(casesFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

interface Offered {
    kind: Diagnostic["kind"];
    span: Span | undefined;
    fixes: Fix[];
}

async function openCase(name: string): Promise<DesignTokens> {
    const folder = join(casesFolder, name);
    const { entry, options } = JSON.parse(readFileSync(join(folder, "expected.json"), "utf8"));
    return read(entry, {
        ...readOptions(options),
        readText: textIn(join(folder, "input")),
    });
}

function expectedFor(name: string): Offered[] {
    const file = join(expectedFolder, `${name}.json`);
    if (!existsSync(file)) return [];
    const written = JSON.parse(readFileSync(file, "utf8"));
    const inputs = inputFiles(join(casesFolder, name, "input"));
    return (withSpans(written, inputs) as { diagnostics: Offered[] }).diagnostics;
}

function offered(tokens: DesignTokens): Offered[] {
    return tokens.diagnostics.flatMap((diagnostic) => {
        const fixes = fixesFor(tokens, diagnostic);
        return fixes.length > 0 ? [{ kind: diagnostic.kind, span: diagnostic.span, fixes }] : [];
    });
}

function leftAfter(tokens: DesignTokens, { edits: [edit] }: Fix): string[] {
    if (!edit) throw new Error("a fix changes something");
    const { file, offset, length, text } = edit;
    const before = tokens.text(file) ?? "";
    const after = tokens.reread({
        [file]: before.slice(0, offset) + text + before.slice(offset + length),
    });
    return after.diagnosticsAt({ file, offset, length: text.length }).map(({ message }) => message);
}

async function readFiles(files: Record<string, string>): Promise<DesignTokens> {
    const [entry] = Object.keys(files);
    if (entry === undefined) throw new Error("design tokens need a file");
    return read(entry, {
        readText: async (path) => files[path],
    });
}

describe.each(cases)("%s", (name) => {
    it("offers the fixes expected for each diagnostic", async () => {
        expect(offered(await openCase(name))).toStrictEqual(expectedFor(name));
    });

    it("leaves each place a safe fix mends reading clean", async () => {
        const opened = await openCase(name);
        const safe = offered(opened).flatMap(({ fixes }) => fixes.filter((fix) => fix.safe));
        for (const fix of safe) {
            expect(fix.edits).toHaveLength(1);
            expect(leftAfter(opened, fix), fix.title).toStrictEqual([]);
        }
    });
});

describe("fixes that depend on other tokens", () => {
    it("offers no pointer when the target's whole value does not fit the place", async () => {
        const opened = await readFiles({
            "tokens.json": JSON.stringify({
                space: {
                    $type: "dimension",
                    sm: { $value: { value: 8, unit: "rem" } },
                    md: { $value: { value: "{space.sm}", unit: "px" } },
                },
            }),
        });
        const [problem] = opened.diagnostics;
        expect(problem?.kind).toBe("invalid-value");
        expect(problem && fixesFor(opened, problem)).toStrictEqual([]);
    });

    it("offers a pointer when the target's whole value fits the place", async () => {
        const opened = await readFiles({
            "tokens.json": JSON.stringify({
                base: { $type: "number", $value: 4 },
                space: { $type: "dimension", $value: { value: "{base}", unit: "px" } },
            }),
        });
        const [problem] = opened.diagnostics;
        const [fix] = problem ? fixesFor(opened, problem) : [];
        expect(fix?.safe).toBe(true);
        expect(fix?.edits.map(({ text }) => text)).toStrictEqual(['{ "$ref": "#/base/$value" }']);
        expect(fix && leftAfter(opened, fix)).toStrictEqual([]);
    });

    it("offers a similar name for a pointer to a missing token, written as a pointer", async () => {
        const opened = await readFiles({
            "tokens.json": JSON.stringify({
                color: {
                    $type: "color",
                    ink: { $value: { colorSpace: "srgb", components: [0, 0, 0] } },
                    text: { $value: { $ref: "#/color/inc/$value" } },
                    border: { $value: "{color.inc}" },
                },
            }),
        });
        const offeredHere = offered(opened).map(({ fixes }) =>
            fixes.map(({ title, edits }) => ({ title, texts: edits.map(({ text }) => text) })),
        );
        expect(offeredHere).toStrictEqual([
            [
                {
                    title: "use `#/color/ink/$value`, which has a similar name",
                    texts: ['"#/color/ink/$value"'],
                },
            ],
            [{ title: "use `color.ink`, which has a similar name", texts: ['"{color.ink}"'] }],
        ]);
        for (const [fix] of offered(opened).map(({ fixes }) => fixes)) {
            expect(fix && leftAfter(opened, fix)).toStrictEqual([]);
        }
    });

    it("renames only the places that write the missing reference", async () => {
        const opened = await readFiles({
            "tokens.json": JSON.stringify({
                color: {
                    $type: "color",
                    ink: { $value: { colorSpace: "srgb", components: [0, 0, 0] } },
                    mix: {
                        $value: {
                            colorSpace: "srgb",
                            components: [{ $ref: "#/color/inc/$value/components/0" }, 0, 0],
                        },
                    },
                },
                hue: { $type: "number", $value: { $ref: "#/color/mix/$value/components/0" } },
            }),
        });
        const missing = opened.diagnostics.find(({ kind }) => kind === "missing-reference");
        const [fix] = missing ? fixesFor(opened, missing) : [];
        expect(missing?.related?.length).toBe(1);
        expect(fix?.edits.map(({ text }) => text)).toStrictEqual([
            '"#/color/ink/$value/components/0"',
        ]);
    });

    it("deletes an empty $type only when the token then takes its group's type", async () => {
        const untyped = await readFiles({
            "tokens.json": JSON.stringify({
                border: { thin: { $type: "", $value: { value: 1, unit: "px" } } },
            }),
        });
        const [problem] = untyped.diagnostics;
        expect(problem?.kind).toBe("unknown-type");
        expect(problem && fixesFor(untyped, problem)).toStrictEqual([]);
    });
});

describe("expected fixes", () => {
    it("are kept only for cases that exist", () => {
        const kept = readdirSync(expectedFolder).map((file) => file.replace(/\.json$/, ""));
        expect(kept.filter((name) => !cases.includes(name))).toStrictEqual([]);
    });
});
