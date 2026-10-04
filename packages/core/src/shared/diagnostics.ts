import type { Token } from "@sugarcube-sh/dtcg";
import type {
    SugarcubeDiagnostic,
    SugarcubeDiagnosticDetailByKind,
    SugarcubeDiagnosticKind,
} from "../types/diagnostics.js";
import { ErrorMessages, diagnosticDocs } from "./constants/error-messages.js";

export function diagnostic<K extends SugarcubeDiagnosticKind>(
    kind: K,
    detail: SugarcubeDiagnosticDetailByKind[K],
    token?: Token,
): SugarcubeDiagnostic {
    const { severity, message } = ErrorMessages.DIAGNOSTICS[kind];
    return {
        kind,
        severity,
        message: message(detail),
        ...(token && { path: token.path, at: token.source.at }),
        docs: diagnosticDocs(kind),
        detail,
    } as SugarcubeDiagnostic;
}
