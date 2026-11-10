import type { DesignTokens, Token } from "@sugarcube-sh/dtcg";
import type {
    SugarcubeDiagnostic,
    SugarcubeDiagnosticDetailByKind,
    SugarcubeDiagnosticKind,
} from "../types/diagnostics.js";
import { ErrorMessages, diagnosticDocs } from "./constants/error-messages.js";
import { getSpan } from "@sugarcube-sh/dtcg/editor";

export interface AboutToken {
    token: Token;
    problem: SugarcubeDiagnostic;
}

export function diagnostic<K extends SugarcubeDiagnosticKind>(
    kind: K,
    detail: SugarcubeDiagnosticDetailByKind[K],
): SugarcubeDiagnostic {
    const { severity, message, help } = ErrorMessages.DIAGNOSTICS[kind];
    const fix = help?.(detail);
    return {
        kind,
        severity,
        message: message(detail),
        ...(fix !== undefined && { help: fix }),
        docsUrl: diagnosticDocs(kind),
        detail,
    } as SugarcubeDiagnostic;
}

export function aboutToken<K extends SugarcubeDiagnosticKind>(
    token: Token,
    kind: K,
    detail: SugarcubeDiagnosticDetailByKind[K],
): AboutToken {
    return { token, problem: diagnostic(kind, detail) };
}

export function located(tokens: DesignTokens, found: readonly AboutToken[]): SugarcubeDiagnostic[] {
    return found.map(({ token, problem: { kind, severity, message, help, docsUrl, detail } }) => ({
        kind,
        severity,
        message,
        ...(help !== undefined && { help }),
        path: token.path,
        span: getSpan(tokens, token.winningDefinition),
        docsUrl,
        detail,
    })) as SugarcubeDiagnostic[];
}
