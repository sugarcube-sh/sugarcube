import type { DesignTokens, Group, Token } from "@sugarcube-sh/dtcg";
import { deprecate, setDescription } from "@sugarcube-sh/dtcg-edit";
import { type Edit, createMergeKey } from "./undo";

export interface DescriptionView {
    readonly text: string;
    readonly editable: boolean;
    readonly from?: string;
}

export function getDescriptionView(node: Token | Group, editable: boolean): DescriptionView {
    const from = node.kind === "group" ? node.descriptionFrom?.path : undefined;
    return { text: node.description ?? "", editable, ...(from !== undefined && { from }) };
}

export function createDescriptionEdit(tokens: DesignTokens, path: string, text: string): Edit {
    return {
        result: setDescription(tokens, path, text === "" ? null : text),
        options: { mergeKey: createMergeKey({ path, property: "description" }) },
    };
}

export interface DeprecationView {
    readonly notice?: { readonly group?: string; readonly message?: string };
    readonly checkbox?: {
        readonly checked: boolean;
        readonly uncheckedValue: false | null;
        readonly message: string;
    };
}

export function getDeprecationView(node: Token | Group, editable: boolean): DeprecationView {
    const { deprecated } = node;
    const group = node.deprecatedFrom?.path;
    const isDeprecated = deprecated !== undefined;
    const notice = {
        ...(group !== undefined && { group }),
        ...(typeof deprecated === "string" && { message: deprecated }),
    };
    const checkbox = editable ? getCheckbox(node, isDeprecated, notice.message ?? "") : undefined;
    return { ...(isDeprecated && { notice }), ...(checkbox && { checkbox }) };
}

function getCheckbox(
    node: Token | Group,
    isDeprecated: boolean,
    message: string,
): DeprecationView["checkbox"] {
    if (getWrittenDeprecation(node) !== undefined || !isDeprecated) {
        return { checked: isDeprecated, uncheckedValue: null, message };
    }
    if (node.deprecatedFrom?.via === "extends") {
        return { checked: true, uncheckedValue: false, message };
    }
    return undefined;
}

function getWrittenDeprecation(node: Token | Group): boolean | string | undefined {
    if (node.kind === "group") return node.local?.deprecated;
    return node.winningDefinition.local.deprecated;
}

export function createDeprecationEdit(
    tokens: DesignTokens,
    path: string,
    checkbox: NonNullable<DeprecationView["checkbox"]>,
    checked: boolean,
    reason: string,
): Edit {
    return {
        result: deprecate(tokens, path, toDeprecatedValue(checkbox, checked, reason)),
        options: { mergeKey: createMergeKey({ path, property: "deprecated" }) },
    };
}

function toDeprecatedValue(
    { uncheckedValue }: NonNullable<DeprecationView["checkbox"]>,
    checked: boolean,
    reason: string,
): string | boolean | null {
    if (!checked) return uncheckedValue;
    return reason === "" ? true : reason;
}
