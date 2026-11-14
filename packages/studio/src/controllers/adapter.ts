import type {
    DesignTokens,
    DiagnosticOf,
    Group,
    JsonValue,
    ReadOptions,
    Token,
    TokenType,
} from "@sugarcube-sh/dtcg";
import type { OperationResult, DefinitionOptions } from "@sugarcube-sh/dtcg-edit";
import type { TypographyCSS } from "@sugarcube-sh/dtcg/css";

export type BuildProblem = DiagnosticOf<Record<string, unknown>>;

export interface BuildOutput {
    getValue(token: Token): string | TypographyCSS | undefined;
    readonly css: string;
    readonly problems: readonly BuildProblem[];
}

export interface FormField {
    readonly key: string;
    readonly label: string;
    readonly type: TokenType | undefined;
    readonly value: JsonValue | undefined;
}

export interface ExtensionForm {
    readonly label: string;
    readonly fields: readonly FormField[];
    write?(key: string, value: JsonValue): OperationResult;
}

export interface BuildAdapter {
    readonly readOptions: ReadOptions;
    write(tokens: DesignTokens): BuildOutput;
    getForm?(
        tokens: DesignTokens,
        node: Token | Group,
        at?: DefinitionOptions["at"],
    ): ExtensionForm | undefined;
}
