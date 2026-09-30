import { diagnosticMessages } from "../error-messages.js";
import type { Diagnostic, DiagnosticDetailByKind, DiagnosticKind } from "../index.js";

type Extra = Partial<
    Pick<Diagnostic, "at" | "path" | "permutation" | "related" | "fixes" | "tags">
>;

export function diagnostic<K extends DiagnosticKind>(
    kind: K,
    detail: DiagnosticDetailByKind[K],
    extra: Extra = {},
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
