import type { ColorSpace, Diagnostic, DiagnosticOf } from "@sugarcube-sh/dtcg";

export interface SugarcubeDiagnosticDetailByKind {
    "default-required": { modifiers: string[] };
    "fluid-text-zoom": { from: number; to: number };
    "option-renamed": { from: string; to: string };
    "fallback-missing": { colorSpace: ColorSpace };
    "same-variable-name": { name: string; paths: [string, string] };
    "same-utility-class": { className: string; paths: [string, string] };
}

export type SugarcubeDiagnosticKind = keyof SugarcubeDiagnosticDetailByKind;

export type SugarcubeDiagnostic = DiagnosticOf<SugarcubeDiagnosticDetailByKind>;

export type Reported = Diagnostic | SugarcubeDiagnostic;
