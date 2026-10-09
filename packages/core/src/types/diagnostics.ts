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

export type ConfigIssue =
    | { reason: "not-loaded"; file: string; cause: string }
    | { reason: "wrong-type"; setting: string; expected: string[]; received: string }
    | { reason: "missing"; setting: string; property: string }
    | { reason: "not-allowed"; setting: string; allowed: unknown[]; value: unknown }
    | { reason: "invalid"; setting: string; message: string };

export interface SugarcubeDiagnosticDetailByKind {
    "default-required": { modifiers: string[] };
    "fluid-text-zoom": { from: number; to: number };
    "option-renamed": { from: string; to: string };
    "option-deprecated": { option: string } & Partial<UtilityEntry>;
    "fallback-missing": { colorSpace: ColorSpace };
    "same-variable-name": { name: string; paths: [string, string] };
    "same-utility-class": { className: string; paths: [string, string] };
    "utility-without-classes": UtilityWithoutClasses;
    "safelist-without-token": UtilityEntry & { part: string };
    "invalid-config": ConfigIssue;
}

export type SugarcubeDiagnosticKind = keyof SugarcubeDiagnosticDetailByKind;

export type SugarcubeDiagnostic = DiagnosticOf<SugarcubeDiagnosticDetailByKind>;

export type Reported = Diagnostic | SugarcubeDiagnostic;
