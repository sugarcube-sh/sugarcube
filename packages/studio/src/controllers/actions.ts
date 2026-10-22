import {
    type DesignTokens,
    type Group,
    type JsonValue,
    type TokenType,
    childPath,
} from "@sugarcube-sh/dtcg";
import { type NewToken, create, remove, rename } from "@sugarcube-sh/dtcg-edit";
import type { Edit } from "./undo";

export function nameOf(path: string): string {
    return path.slice(path.lastIndexOf(".") + 1);
}

export function renameEdit(tokens: DesignTokens, path: string, name: string): Edit {
    return { result: rename(tokens, path, name), options: {} };
}

export type Removal =
    | { readonly kind: "now"; readonly edit: Edit }
    | { readonly kind: "asks"; readonly edit: Edit; readonly breaks: readonly string[] };

export function removal(tokens: DesignTokens, path: string): Removal {
    const result = remove(tokens, path);
    const breaks = (result.ops && result.broken) || [];
    const edit = { result, options: {} };
    return breaks.length > 0 ? { kind: "asks", edit, breaks } : { kind: "now", edit };
}

export function newGroupEdit(
    tokens: DesignTokens,
    parent: string,
    name: string,
): Edit & { readonly path: string } {
    const path = childPath(parent, name);
    return { result: create(tokens, path, { group: true }), options: {}, path };
}

export function newTokenEdit(
    tokens: DesignTokens,
    group: Group,
    name: string,
    made: { type: TokenType; value: JsonValue },
): Edit {
    const path = childPath(group.path, name);
    return { result: create(tokens, path, newToken(made, group)), options: {} };
}

export function canAddGroup(name: string): boolean {
    return name !== "";
}

export function canAddToken(name: string, value: JsonValue | undefined): boolean {
    return name !== "" && value !== undefined;
}

export function newToken(
    { type, value }: { type: TokenType; value: JsonValue },
    group: Group | undefined,
): NewToken {
    return type === group?.type ? { $value: value } : { $type: type, $value: value };
}
