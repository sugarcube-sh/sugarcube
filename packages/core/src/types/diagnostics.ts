import type { ColorSpace, Diagnostic, DiagnosticOf, TokenType } from "@sugarcube-sh/dtcg";

export interface UtilityEntry {
    property: string;
    entry?: number;
}

export type UtilityWithoutClassesReason =
    | { reason: "no-tokens"; group: string }
    | { reason: "no-type" }
    | { reason: "private" }
    | { reason: "wrong-type"; found: TokenType[]; takes: TokenType[] }
    | { reason: "typography" }
    | { reason: "answered-first"; starts: string[]; by: UtilityEntry[] };

export type UtilityWithoutClasses = UtilityEntry & { source: string } & UtilityWithoutClassesReason;

export interface SugarcubeDiagnosticDetailByKind {
    "default-required": { modifiers: string[] };
    "fluid-text-zoom": { from: number; to: number };
    "option-renamed": { from: string; to: string };
    "fallback-missing": { colorSpace: ColorSpace };
    "same-variable-name": { name: string; paths: [string, string] };
    "same-utility-class": { className: string; paths: [string, string] };
    "utility-without-classes": UtilityWithoutClasses;
}

export type SugarcubeDiagnosticKind = keyof SugarcubeDiagnosticDetailByKind;

export type SugarcubeDiagnostic = DiagnosticOf<SugarcubeDiagnosticDetailByKind>;

export type Reported = Diagnostic | SugarcubeDiagnostic;
