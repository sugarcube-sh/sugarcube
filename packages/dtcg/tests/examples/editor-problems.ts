// A code editor showing token problems as squiggles, with their severity, a link to docs, and quick
// fixes.
import type { Document, Span } from "@sugarcube-sh/dtcg";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

declare const doc: Document;
declare const folder: string;
declare function publish(uri: string, items: unknown[]): void;

const severity = { error: 1, warning: 2, info: 3, hint: 4 } as const;
const tag = { unnecessary: 1, deprecated: 2 } as const;

const uri = (file: string) => pathToFileURL(join(folder, file)).href;
const range = (span: Span) => ({
    start: { line: span.start.line - 1, character: span.start.column - 1 },
    end: { line: span.end.line - 1, character: span.end.column - 1 },
});

const byFile = new Map<string, unknown[]>();
for (const d of doc.diagnostics) {
    if (!d.at) continue;
    const item = {
        range: range(d.at),
        severity: severity[d.severity],
        code: d.kind,
        codeDescription: { href: d.docs },
        source: "dtcg",
        message: d.message,
        tags: d.tags?.map((t) => tag[t]),
        relatedInformation: d.related?.map((r) => ({
            location: { uri: uri(r.at.file), range: range(r.at) },
            message: r.message,
        })),
        data: d.fixes,
    };
    byFile.set(d.at.file, [...(byFile.get(d.at.file) ?? []), item]);
}
for (const [file, items] of byFile) publish(uri(file), items);
