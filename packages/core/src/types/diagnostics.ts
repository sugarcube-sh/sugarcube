import type { ColorSpace, Diagnostic, DiagnosticOf } from "@sugarcube-sh/dtcg";

export interface SugarcubeDiagnosticDetailByKind {
    "default-required": { modifiers: string[] };
    "fluid-text-zoom": { from: number; to: number };
    "option-renamed": { from: string; to: string };
    "fallback-missing": { colorSpace: ColorSpace };
}

export type SugarcubeDiagnosticKind = keyof SugarcubeDiagnosticDetailByKind;

export type SugarcubeDiagnostic = DiagnosticOf<SugarcubeDiagnosticDetailByKind>;

export type Reported = Diagnostic | SugarcubeDiagnostic;
