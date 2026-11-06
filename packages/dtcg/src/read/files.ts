import type { Span } from "../model.js";
import { relatedMessages } from "../error-messages.js";
import { diagnostic, type Problems } from "./diagnostics.js";
import { type JsonFile, type JsonProblem, type ParsedJson, parseJson, toSpan } from "./json.js";

export type FileText = { text: string } | { missing: true };
export type Request = string[];
export type Answer = Record<string, FileText>;
export type FileKind = "tokens" | "resolver";

export interface Files {
    texts: Map<string, FileText>;
    parsed: Map<string, ParsedJson>;
    opened: Map<string, JsonFile | undefined>;
    used: string[];
    diagnostics: Problems;
}

export function createFiles(diagnostics: Problems): Files {
    return { texts: new Map(), parsed: new Map(), opened: new Map(), used: [], diagnostics };
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
    referencedFrom?: { file: string; span: Span },
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
    referencedFrom?: { file: string; span: Span },
): JsonFile | undefined {
    const { diagnostics } = files;
    const parsed = parseFile(files, path);
    if (!parsed) {
        diagnostics.found(
            diagnostic(
                "file-not-found",
                { file: path, ...(referencedFrom && { referencedFrom: referencedFrom.file }) },
                { ...(referencedFrom && { span: referencedFrom.span }) },
            ),
        );
        return undefined;
    }

    const file = { path, lineStarts: parsed.lineStarts };
    const { root, syntax } = parsed;
    const problems: JsonProblem[] = [
        ...(kind === "tokens" ? parsed.comments : []),
        ...(syntax ? [syntax] : []),
        ...(root && !syntax && root.type !== "object"
            ? [{ reason: "not-an-object" as const, offset: root.offset, length: root.length }]
            : []),
    ];
    for (const problem of problems.sort((a, b) => a.offset - b.offset)) {
        diagnostics.found(
            diagnostic("invalid-json", { reason: problem.reason }, { span: toSpan(file, problem) }),
        );
    }
    if (problems.length > 0 || !root) return undefined;

    for (const { key, first, last } of parsed.duplicates) {
        const relatedInformation = [
            { message: relatedMessages.alsoWrittenHere, span: toSpan(file, first) },
        ];
        diagnostics.found(
            diagnostic("duplicate-key", { key }, { span: toSpan(file, last), relatedInformation }),
        );
    }
    return { path, root, lineStarts: parsed.lineStarts };
}
