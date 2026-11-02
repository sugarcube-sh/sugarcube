// A code editor showing token problems as squiggles, with their severity and a link to docs.
import type { DesignTokens, Span } from "@sugarcube-sh/dtcg";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

declare const tokens: DesignTokens;
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
for (const d of tokens.diagnostics) {
    if (!d.span) continue;
    const item = {
        range: range(d.span),
        severity: severity[d.severity],
        code: d.kind,
        codeDescription: { href: d.docsUrl },
        source: "dtcg",
        message: d.message,
        tags: d.tags?.map((t) => tag[t]),
        relatedInformation: d.relatedInformation?.map((r) => ({
            location: { uri: uri(r.span.file), range: range(r.span) },
            message: r.message,
        })),
    };
    byFile.set(d.span.file, [...(byFile.get(d.span.file) ?? []), item]);
}
for (const [file, items] of byFile) publish(uri(file), items);
