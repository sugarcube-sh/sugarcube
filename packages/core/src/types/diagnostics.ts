import type { ColorSpace, Diagnostic, DiagnosticOf, TokenType } from "@sugarcube-sh/dtcg";

export interface UtilityEntry {
    property: string;
    entry?: number;
}

export type UtilityWithoutClassesReason =
    | { reason: "no-tokens"; group: string }
    | { reason: "no-type" }
    | { reason: "private" }
    | { reason: "wrong-type"; received: TokenType[]; expected: TokenType[] }
    | { reason: "typography" }
    | { reason: "classes-taken"; prefixes: string[]; by: UtilityEntry[] };

export type UtilityWithoutClasses = UtilityEntry & { source: string } & UtilityWithoutClassesReason;

export type TypeName =
    | "string"
    | "number"
    | "boolean"
    | "object"
    | "array"
    | "function"
    | "bigint"
    | "symbol"
    | "null"
    | "undefined"
    | "NaN";

export type ConfigIssue =
    | { reason: "not-loaded"; file: string; cause: string }
    | { reason: "deleted"; file: string }
    | {
          reason: "wrong-type";
          setting: string;
          expected: TypeName[];
          received: TypeName;
          allowed?: string[];
      }
    | { reason: "missing"; setting: string; property: string }
    | { reason: "not-allowed"; setting: string; allowed: unknown[]; value: unknown }
    | { reason: "unknown"; setting: string }
    | { reason: "empty"; setting: string }
    | { reason: "no-selectors"; setting: string }
    | { reason: "empty-source"; setting: string }
    | {
          reason: "wrong-form";
          setting: string;
          value: string;
          form: "repository" | "app" | "sign-in" | "source";
      }
    | { reason: "no-resolver" }
    | { reason: "several-resolvers"; paths: string[] }
    | { reason: "exports-nothing"; file: string };

export interface SugarcubeDiagnosticDetailByKind {
    "default-required": { modifiers: string[] };
    "default-not-first": { file: string; selector: string; after: string };
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

export type AnyDiagnostic = Diagnostic | SugarcubeDiagnostic;
