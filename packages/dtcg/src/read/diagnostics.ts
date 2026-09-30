import { diagnosticMessages } from "../error-messages.js";
import type { Diagnostic, DiagnosticDetailByKind, DiagnosticKind } from "../index.js";

export type DiagnosticExtra = Partial<
    Pick<Diagnostic, "at" | "path" | "permutation" | "related" | "fixes" | "tags">
>;

export function diagnostic<K extends DiagnosticKind>(
    kind: K,
    detail: DiagnosticDetailByKind[K],
    extra: DiagnosticExtra = {},
): Diagnostic {
    const { severity, message } = diagnosticMessages[kind];
    return {
        kind,
        severity,
        message: message(detail),
        ...extra,
        docs: `https://sugarcube.sh/errors/${kind}`,
        detail,
    } as Diagnostic;
}

export function collapse(diagnostics: Diagnostic[], permutations: number): Diagnostic[] {
    const alike = new Map<string, { first: Diagnostic; each: Map<number, Diagnostic> }>();
    for (const found of diagnostics) {
        const key = JSON.stringify({ ...found, permutation: undefined });
        const group = alike.get(key) ?? { first: found, each: new Map<number, Diagnostic>() };
        const { permutation } = found;
        if (permutation !== undefined && !group.each.has(permutation)) {
            group.each.set(permutation, found);
        }
        alike.set(key, group);
    }
    return [...alike.values()].flatMap(({ first, each }) => {
        if (each.size > 0 && each.size < permutations) return Array.from(each.values());
        const everywhere = { ...first };
        delete everywhere.permutation;
        return [everywhere];
    });
}
