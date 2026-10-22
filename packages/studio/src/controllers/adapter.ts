import type {
    DesignTokens,
    DiagnosticOf,
    Group,
    JsonValue,
    ReadOptions,
    Token,
    TokenType,
} from "@sugarcube-sh/dtcg";
import type { OpResult, PlaceAt } from "@sugarcube-sh/dtcg-edit";
import type { TypographyCSS } from "@sugarcube-sh/dtcg/css";

export type BuildProblem = DiagnosticOf<Record<string, unknown>>;

export interface BuildOutput {
    value(token: Token): string | TypographyCSS | undefined;
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
    write?(key: string, value: JsonValue): OpResult;
}

export interface BuildAdapter {
    readonly read: ReadOptions;
    write(tokens: DesignTokens): BuildOutput;
    formFor?(
        tokens: DesignTokens,
        node: Token | Group,
        at?: PlaceAt["at"],
    ): ExtensionForm | undefined;
}
