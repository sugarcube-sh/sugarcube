import type { DesignTokens, Group, Token } from "@sugarcube-sh/dtcg";
import { deprecate, setDescription } from "@sugarcube-sh/dtcg-edit";
import { type Edit, fieldKey } from "./undo";

export interface DescriptionView {
    readonly text: string;
    readonly editable: boolean;
    readonly from?: string;
}

export function descriptionView(node: Token | Group, editable: boolean): DescriptionView {
    const from = node.kind === "group" ? takenFrom(node) : undefined;
    return { text: node.description ?? "", editable, ...(from !== undefined && { from }) };
}

function takenFrom(group: Group): string | undefined {
    const taken = group.authored?.description === undefined && group.description !== undefined;
    return taken ? group.extends?.path : undefined;
}

export function descriptionEdit(tokens: DesignTokens, path: string, text: string): Edit {
    return {
        result: setDescription(tokens, path, text === "" ? null : text),
        options: { merge: fieldKey({ path, writes: "description" }) },
    };
}

export interface DeprecationView {
    readonly line?: { readonly by?: string; readonly message?: string };
    readonly box?: {
        readonly checked: boolean;
        readonly untick: false | null;
        readonly message: string;
    };
}

export function deprecationView(node: Token | Group, editable: boolean): DeprecationView {
    const { deprecated, deprecatedFrom: by } = node;
    const applies = deprecated !== undefined && deprecated !== false;
    const line = {
        ...(by !== undefined && { by }),
        ...(typeof deprecated === "string" && { message: deprecated }),
    };
    const box = editable ? boxFor(node, applies, line.message ?? "") : undefined;
    return { ...(applies && { line }), ...(box && { box }) };
}

function boxFor(node: Token | Group, applies: boolean, message: string): DeprecationView["box"] {
    if (node.authored?.deprecated !== undefined || !applies) {
        return { checked: applies, untick: null, message };
    }
    const by = node.deprecatedFrom;
    if (node.kind === "group" && by !== undefined && extended(node).includes(by)) {
        return { checked: true, untick: false, message };
    }
    return undefined;
}

function extended(group: Group): string[] {
    const paths: string[] = [];
    for (let from = group.extends; from; from = from.extends) paths.push(from.path);
    return paths;
}

export function deprecationEdit(
    tokens: DesignTokens,
    path: string,
    box: NonNullable<DeprecationView["box"]>,
    checked: boolean,
    reason: string,
): Edit {
    return {
        result: deprecate(tokens, path, written(box, checked, reason)),
        options: { merge: fieldKey({ path, writes: "deprecated" }) },
    };
}

function written(
    { untick }: NonNullable<DeprecationView["box"]>,
    checked: boolean,
    reason: string,
): string | boolean | null {
    if (!checked) return untick;
    return reason === "" ? true : reason;
}
