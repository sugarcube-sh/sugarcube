import type { Diagnostic, Span } from "../index.js";
import { diagnostic } from "./diagnostics.js";
import { type JsonFile, type JsonProblem, type ParsedJson, parseJson, spanOf } from "./json.js";

export type FileText = { text: string } | { missing: true };
export type Request = string[];
export type Answer = Record<string, FileText>;
export type FileKind = "tokens" | "resolver";

export interface Files {
    texts: Map<string, FileText>;
    parsed: Map<string, ParsedJson>;
    opened: Map<string, JsonFile | undefined>;
    used: string[];
    diagnostics: Diagnostic[];
}

export function createFiles(used: string[], diagnostics: Diagnostic[]): Files {
    return { texts: new Map(), parsed: new Map(), opened: new Map(), used, diagnostics };
}

export function* fetchFiles(files: Files, paths: string[]): Generator<Request, void, Answer> {
    const wanted = [...new Set(paths)].filter((path) => !files.texts.has(path));
    if (wanted.length === 0) return;
    const answer = yield wanted;
    for (const path of wanted) files.texts.set(path, answer[path] ?? { missing: true });
}

export function parseFile(files: Files, path: string): ParsedJson | undefined {
    const cached = files.parsed.get(path);
    if (cached) return cached;
    const text = files.texts.get(path);
    if (!text || "missing" in text) return undefined;
    const parsed = parseJson(text.text);
    files.parsed.set(path, parsed);
    return parsed;
}

export function openFile(
    files: Files,
    path: string,
    kind: FileKind,
    referencedFrom?: { file: string; at: Span },
): JsonFile | undefined {
    if (files.opened.has(path)) return files.opened.get(path);
    files.used.push(path);
    const file = openOnce(files, path, kind, referencedFrom);
    files.opened.set(path, file);
    return file;
}

function openOnce(
    files: Files,
    path: string,
    kind: FileKind,
    referencedFrom?: { file: string; at: Span },
): JsonFile | undefined {
    const { diagnostics } = files;
    const parsed = parseFile(files, path);
    if (!parsed) {
        diagnostics.push(
            diagnostic(
                "file-not-found",
                { file: path, ...(referencedFrom && { referencedFrom: referencedFrom.file }) },
                { ...(referencedFrom && { at: referencedFrom.at }) },
            ),
        );
        return undefined;
    }

    const at = (node: { offset: number; length: number }) =>
        spanOf(path, parsed.lineStarts, node.offset, node.length);
    const { root, syntax } = parsed;
    const problems: JsonProblem[] = [
        ...(kind === "tokens" ? parsed.comments : []),
        ...(syntax ? [syntax] : []),
        ...(root && !syntax && root.type !== "object"
            ? [{ reason: "not-an-object" as const, offset: root.offset, length: root.length }]
            : []),
    ];
    for (const problem of problems.sort((a, b) => a.offset - b.offset)) {
        diagnostics.push(
            diagnostic("invalid-json", { reason: problem.reason }, { at: at(problem) }),
        );
    }
    if (problems.length > 0 || !root) return undefined;

    for (const { key, first, last } of parsed.duplicates) {
        diagnostics.push(
            diagnostic(
                "duplicate-key",
                { key },
                { at: at(last), related: [{ message: "also written here", at: at(first) }] },
            ),
        );
    }
    return { path, root, lineStarts: parsed.lineStarts, hidden: parsed.hidden };
}
