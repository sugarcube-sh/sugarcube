import type { DesignTokens, Group, Token } from "@sugarcube-sh/dtcg";
import { deprecate, setDescription } from "@sugarcube-sh/dtcg-edit";
import { type Edit, createMergeKey } from "./undo";

export interface DescriptionView {
    readonly text: string;
    readonly editable: boolean;
    readonly from?: string;
}

export function getDescriptionView(node: Token | Group, editable: boolean): DescriptionView {
    const from = node.kind === "group" ? findDescriptionSource(node) : undefined;
    return { text: node.description ?? "", editable, ...(from !== undefined && { from }) };
}

function findDescriptionSource(group: Group): string | undefined {
    const isInherited =
        group.original?.description === undefined && group.description !== undefined;
    return isInherited ? group.extends?.path : undefined;
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
    const { deprecated, deprecatedByGroup: group } = node;
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
    if (node.original?.deprecated !== undefined || !isDeprecated) {
        return { checked: isDeprecated, uncheckedValue: null, message };
    }
    const group = node.deprecatedByGroup;
    if (node.kind === "group" && group !== undefined && getExtendedPaths(node).includes(group)) {
        return { checked: true, uncheckedValue: false, message };
    }
    return undefined;
}

function getExtendedPaths(group: Group): string[] {
    const paths: string[] = [];
    for (let from = group.extends; from; from = from.extends) paths.push(from.path);
    return paths;
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
