import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Diagnostic, type Fix, type Span, readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { inputFiles, readOptions } from "../../dtcg/tests/read/case-options.js";
import { withSpans } from "../../dtcg/tests/read/positions.js";
import { type Project, fixesFor, open } from "../src/index.js";

const casesFolder = join(import.meta.dirname, "../../dtcg/tests/read/cases");
const expectedFolder = join(import.meta.dirname, "fixes");
const cases = readdirSync(casesFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

interface Offered {
    kind: Diagnostic["kind"];
    at: Span | undefined;
    fixes: Fix[];
}

async function openCase(name: string): Promise<Project> {
    const folder = join(casesFolder, name);
    const { entry, options } = JSON.parse(readFileSync(join(folder, "expected.json"), "utf8"));
    return open(entry, {
        ...readOptions(options),
        readText: (path) => readFile(join(folder, "input", path), "utf8"),
    });
}

function expectedFor(name: string): Offered[] {
    const file = join(expectedFolder, `${name}.json`);
    if (!existsSync(file)) return [];
    const written = JSON.parse(readFileSync(file, "utf8"));
    const inputs = inputFiles(join(casesFolder, name, "input"));
    return (withSpans(written, inputs) as { diagnostics: Offered[] }).diagnostics;
}

function offered(project: Project): Offered[] {
    return project.doc.diagnostics.flatMap((diagnostic) => {
        const fixes = fixesFor(project, diagnostic);
        return fixes.length > 0 ? [{ kind: diagnostic.kind, at: diagnostic.at, fixes }] : [];
    });
}

function leftAfter(project: Project, { edits: [edit] }: Fix): string[] {
    if (!edit) throw new Error("a fix changes something");
    const { file, offset, length, text } = edit;
    const before = project.files[file] ?? "";
    const files = {
        ...project.files,
        [file]: before.slice(0, offset) + text + before.slice(offset + length),
    };
    const doc = readFromMemory({ files, entry: project.doc.files[0] }, project.options);
    const end = offset + text.length;
    return doc.diagnostics
        .filter(
            ({ at }) => at?.file === file && at.offset <= end && offset <= at.offset + at.length,
        )
        .map(({ message }) => message);
}

async function projectOf(files: Record<string, string>): Promise<Project> {
    const [entry] = Object.keys(files);
    if (entry === undefined) throw new Error("a project needs a file");
    return open(entry, {
        readText: async (path) => files[path] ?? Promise.reject(new Error("missing")),
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
        const opened = await projectOf({
            "tokens.json": JSON.stringify({
                space: {
                    $type: "dimension",
                    sm: { $value: { value: 8, unit: "rem" } },
                    md: { $value: { value: "{space.sm}", unit: "px" } },
                },
            }),
        });
        const [problem] = opened.doc.diagnostics;
        expect(problem?.kind).toBe("invalid-value");
        expect(problem && fixesFor(opened, problem)).toStrictEqual([]);
    });

    it("offers a pointer when the target's whole value fits the place", async () => {
        const opened = await projectOf({
            "tokens.json": JSON.stringify({
                base: { $type: "number", $value: 4 },
                space: { $type: "dimension", $value: { value: "{base}", unit: "px" } },
            }),
        });
        const [problem] = opened.doc.diagnostics;
        const [fix] = problem ? fixesFor(opened, problem) : [];
        expect(fix?.safe).toBe(true);
        expect(fix?.edits.map(({ text }) => text)).toStrictEqual(['{ "$ref": "#/base/$value" }']);
        expect(fix && leftAfter(opened, fix)).toStrictEqual([]);
    });

    it("deletes an empty $type only when the token then takes its group's type", async () => {
        const untyped = await projectOf({
            "tokens.json": JSON.stringify({
                border: { thin: { $type: "", $value: { value: 1, unit: "px" } } },
            }),
        });
        const [problem] = untyped.doc.diagnostics;
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
