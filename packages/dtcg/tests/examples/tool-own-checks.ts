// Reports a tool's own problems beside the package's, in the same shape, so one list can be shown,
// filtered by severity and switched on by kind.
import type { Diagnostic, DiagnosticOf, Document } from "@sugarcube-sh/dtcg";

declare const doc: Document;

interface OurDetailByKind {
    "selector-empty": { entry: number };
    "default-required": { modifiers: string[] };
}

type Reported = Diagnostic | DiagnosticOf<OurDetailByKind>;

const ours: DiagnosticOf<OurDetailByKind> = {
    kind: "selector-empty",
    severity: "error",
    message: "the selector is empty",
    docs: "https://example.com/errors/selector-empty",
    detail: { entry: 2 },
};

const reported: Reported[] = [...doc.diagnostics, ours];

for (const d of reported) {
    if (d.severity !== "error") continue;
    if (d.kind === "selector-empty") showMessage(`permutations[${d.detail.entry}]: ${d.message}`);
    else if (d.kind === "default-required") showMessage(d.detail.modifiers.join(", "));
    else if (d.kind === "missing-reference") showMessage(d.detail.referencedBy.join(", "));
    else showMessage(d.message);
}
