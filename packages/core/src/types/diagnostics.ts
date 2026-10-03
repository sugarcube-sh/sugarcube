import type { Diagnostic, DiagnosticOf } from "@sugarcube-sh/dtcg";

export interface SugarcubeDiagnosticDetailByKind {
    "default-required": { modifiers: string[] };
    "fluid-text-zoom": { from: number; to: number };
}

export type SugarcubeDiagnostic = DiagnosticOf<SugarcubeDiagnosticDetailByKind>;

export type Reported = Diagnostic | SugarcubeDiagnostic;
