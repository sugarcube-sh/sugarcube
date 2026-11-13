import type { DesignTokens, Token } from "@sugarcube-sh/dtcg";
import type {
    SugarcubeDiagnostic,
    SugarcubeDiagnosticDetailByKind,
    SugarcubeDiagnosticKind,
} from "../types/diagnostics.js";
import { ErrorMessages, getDiagnosticDocsURL } from "./constants/error-messages.js";
import { getNameSpan } from "@sugarcube-sh/dtcg/editor";

export interface TokenProblem {
    token: Token;
    problem: SugarcubeDiagnostic;
}

export function createDiagnostic<K extends SugarcubeDiagnosticKind>(
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
        docsUrl: getDiagnosticDocsURL(kind),
        detail,
    } as SugarcubeDiagnostic;
}

export function createTokenProblem<K extends SugarcubeDiagnosticKind>(
    token: Token,
    kind: K,
    detail: SugarcubeDiagnosticDetailByKind[K],
): TokenProblem {
    return { token, problem: createDiagnostic(kind, detail) };
}

export function locateProblems(
    tokens: DesignTokens,
    found: readonly TokenProblem[],
): SugarcubeDiagnostic[] {
    return found.map(({ token, problem: { kind, severity, message, help, docsUrl, detail } }) => ({
        kind,
        severity,
        message,
        ...(help !== undefined && { help }),
        path: token.path,
        span: getNameSpan(tokens, token.winningDefinition),
        docsUrl,
        detail,
    })) as SugarcubeDiagnostic[];
}
