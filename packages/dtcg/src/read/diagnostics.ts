import { diagnosticMessages } from "../error-messages.js";
import type { Diagnostic, DiagnosticDetailByKind, DiagnosticKind } from "../index.js";

export type DiagnosticExtra = Partial<Pick<Diagnostic, "at" | "path" | "related" | "tags">> & {
    permutation?: number;
};

export function diagnostic<K extends DiagnosticKind>(
    kind: K,
    detail: DiagnosticDetailByKind[K],
    { permutation, ...extra }: DiagnosticExtra = {},
): Diagnostic {
    const { severity, message } = diagnosticMessages[kind];
    return {
        kind,
        severity: typeof severity === "function" ? severity(detail) : severity,
        message: message(detail),
        ...extra,
        ...(permutation !== undefined && { permutations: [permutation] }),
        docs: docsFor(kind, detail),
        detail,
    } as Diagnostic;
}

function docsFor<K extends DiagnosticKind>(kind: K, detail: DiagnosticDetailByKind[K]): string {
    const page = `https://sugarcube.sh/errors/${kind}`;
    if (kind !== "invalid-value") return page;
    return `${page}#${(detail as DiagnosticDetailByKind["invalid-value"]).reason}`;
}

export function collapse(diagnostics: Diagnostic[], permutations: number): Diagnostic[] {
    const alike = new Map<string, Diagnostic>();
    for (const found of diagnostics) {
        const key = JSON.stringify({ ...found, permutations: undefined });
        const earlier = alike.get(key);
        if (!earlier) alike.set(key, found);
        else if (earlier.permutations && found.permutations) {
            earlier.permutations = [...new Set([...earlier.permutations, ...found.permutations])];
        }
    }
    const collapsed = [...alike.values()];
    for (const found of collapsed) {
        if (found.permutations?.length === permutations) delete found.permutations;
    }
    return collapsed;
}
