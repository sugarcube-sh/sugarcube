import type {
    DesignTokens,
    JsonPath,
    JsonValue,
    Permutation,
    DefinitionInPermutations,
    Span,
    Token,
} from "@sugarcube-sh/dtcg";
import {
    type Clash,
    type ValueOptions,
    getOverridableContexts,
    setValue,
} from "@sugarcube-sh/dtcg-edit";
import { isJsonObject } from "@sugarcube-sh/dtcg/values";
import type { ExtensionForm } from "./adapter";
import {
    type DeprecationView,
    type DescriptionView,
    getDeprecationView,
    getDescriptionView,
} from "./properties";
import type { StudioState } from "./studio";
import { type Edit, createMergeKey } from "./undo";
import { type ProblemRow, type TokenRow, toProblemRows, toTokenRow } from "./views";

export interface DefinitionRow {
    readonly label: string | undefined;
    readonly value: JsonValue | undefined;
    readonly span: Span;
}

export function getDefinitionRows(tokens: DesignTokens, path: string): DefinitionRow[] {
    return tokens.getDefinitions(path).map((definition) => ({
        label: getDefinitionLabel(definition),
        value: isJsonObject(definition.json) ? definition.json.$value : undefined,
        span: definition.span,
    }));
}

export interface ValueRow {
    readonly key: string;
    readonly label: string | undefined;
    readonly value: JsonValue | undefined;
    readonly isNew: boolean;
    readonly valueOptions: ValueOptions;
}

export function createValueEdit(
    tokens: DesignTokens,
    path: string,
    row: ValueRow,
    value: JsonValue,
    part?: JsonPath,
    control?: string,
): Edit {
    return {
        result: setValue(tokens, path, value, { ...row.valueOptions, part }),
        options: {
            mergeKey: createMergeKey({ path, property: "value", row: row.label, part, control }),
        },
    };
}

export interface ValueView {
    readonly rows: readonly ValueRow[];
    readonly overridableContexts: readonly string[];
    readonly editable: boolean;
}

export function getValueView(
    tokens: DesignTokens,
    path: string,
    adding: readonly string[],
): ValueView {
    if (tokens.permutations.some((perm) => perm.getToken(path)?.generated)) {
        return { rows: [], overridableContexts: [], editable: false };
    }
    const places = getDefinitionRows(tokens, path);
    const overridable = getOverridableContexts(tokens, path);
    const definitionRows = places
        .filter(
            (definition) => definition.label === undefined || !adding.includes(definition.label),
        )
        .map((definition) => ({
            key: `${definition.span.file}:${definition.span.offset}`,
            label: definition.label,
            value: definition.value,
            isNew: false,
            valueOptions: { at: definition.span },
        }));
    const overrides = adding.flatMap((label): ValueRow[] => {
        const key = `adding ${label}`;
        const definition = places.find((each) => each.label === label);
        if (definition) {
            return [
                {
                    key,
                    label,
                    value: definition.value,
                    isNew: false,
                    valueOptions: { at: definition.span },
                },
            ];
        }
        const context = overridable.find((each) => each.label === label);
        if (!context) return [];
        const winningJson = tokens.getPermutation(context.input).getToken(path)
            ?.winningDefinition.json;
        return [
            {
                key,
                label,
                value: isJsonObject(winningJson) ? winningJson.$value : undefined,
                isNew: true,
                valueOptions: { input: context.input },
            },
        ];
    });
    return {
        rows: [...definitionRows, ...overrides],
        overridableContexts: overridable
            .map(({ label }) => label)
            .filter((label) => !adding.includes(label)),
        editable: true,
    };
}

export type GenerationSource =
    | { readonly kind: "recipe"; readonly from: string; readonly by: string }
    | { readonly kind: "group"; readonly from: string }
    | { readonly kind: "top-level" };

export function getGenerationSource(
    token: Token,
    showing: Permutation,
    getForm: StudioState["getForm"],
): GenerationSource | undefined {
    if (!token.generated) return undefined;
    const { from } = token.generated;
    if (from === "") return { kind: "top-level" };
    const group = showing.getGroup(from);
    const by = group && getForm(group)?.label.toLowerCase();
    return by === undefined ? { kind: "group", from } : { kind: "recipe", from, by };
}

export interface TokenPageRow extends ValueRow {
    readonly form: ExtensionForm | undefined;
    readonly name: string | undefined;
    readonly fieldLabel: string;
}

function toTokenPageRow(
    row: ValueRow,
    token: Token,
    getForm: StudioState["getForm"],
): TokenPageRow {
    const name = row.isNew ? `Override for ${row.label}` : row.label;
    return {
        ...row,
        form: getForm(token, row.valueOptions.at),
        name,
        fieldLabel: name ?? token.path,
    };
}

export interface TokenPageView {
    readonly row: TokenRow;
    readonly rows: readonly TokenPageRow[];
    readonly overridableContexts: readonly string[];
    readonly editable: boolean;
    readonly problems: readonly ProblemRow[];
    readonly generatedBy: GenerationSource | undefined;
    readonly form: ExtensionForm | undefined;
    readonly description: DescriptionView;
    readonly deprecation: DeprecationView;
}

export function getTokenPageView(
    state: StudioState,
    token: Token,
    adding: readonly string[],
): TokenPageView {
    const { tokens, shownPermutation, getValue, getForm } = state;
    const view = getValueView(tokens, token.path, adding);
    const editable = view.editable && token.inherited === undefined;
    return {
        row: toTokenRow(token, token.path, getValue),
        rows: view.rows.map((row) => toTokenPageRow(row, token, getForm)),
        overridableContexts: view.overridableContexts,
        editable,
        problems: toProblemRows(tokens.getDiagnostics(token.path)),
        generatedBy: getGenerationSource(token, shownPermutation, getForm),
        form: getForm(token),
        description: getDescriptionView(token, editable),
        deprecation: getDeprecationView(token, editable),
    };
}

export type ClashRow = { readonly clash: Clash; readonly canKeepYours: boolean } & (
    | { readonly kind: "renamed"; readonly from: string; readonly to: string }
    | {
          readonly kind: "changed" | "gone" | "removed";
          readonly path: string;
          readonly label: string | undefined;
          readonly yours: unknown;
          readonly theirs: unknown;
      }
);

export function toClashRows(tokens: DesignTokens, clashes: readonly Clash[]): ClashRow[] {
    return clashes.map((clash) => {
        const { canKeepYours } = clash;
        const [move] = clash.step.moves;
        if (move) return { clash, canKeepYours, kind: "renamed", from: move.from, to: move.to };
        const [part] = clash.parts;
        const path = part?.path ?? part?.file ?? "";
        return {
            clash,
            canKeepYours,
            kind: !canKeepYours ? "gone" : part?.yours === undefined ? "removed" : "changed",
            path,
            label: getDefinitionRows(tokens, path).find(({ span: at }) => at.file === part?.file)
                ?.label,
            yours: getTokenValue(part?.yours),
            theirs: getTokenValue(part?.theirs),
        };
    });
}

function getDefinitionLabel({
    sources,
    permutations,
}: DefinitionInPermutations): string | undefined {
    if (sources.some((source) => source.modifier)) return permutations.label;
    return sources[0]?.sets[0]?.name;
}

function getTokenValue(member: JsonValue | undefined): unknown {
    return isJsonObject(member) ? member.$value : member;
}
