import {
    type DesignTokens,
    type Group,
    type JsonValue,
    type TokenType,
    tokenPath,
} from "@sugarcube-sh/dtcg";
import { type NewToken, create, remove, rename } from "@sugarcube-sh/dtcg-edit";
import type { Edit } from "./undo";

export function createRenameEdit(tokens: DesignTokens, path: string, name: string): Edit {
    return { result: rename(tokens, path, name), options: {} };
}

export type Removal =
    | { readonly kind: "immediate"; readonly edit: Edit }
    | {
          readonly kind: "confirm";
          readonly edit: Edit;
          readonly pathsWithBrokenReferences: readonly string[];
      };

export function createRemoval(tokens: DesignTokens, path: string): Removal {
    const result = remove(tokens, path);
    const brokenPaths = (result.ops && result.pathsWithBrokenReferences) || [];
    const edit = { result, options: {} };
    return brokenPaths.length > 0
        ? { kind: "confirm", edit, pathsWithBrokenReferences: brokenPaths }
        : { kind: "immediate", edit };
}

export function createGroupEdit(
    tokens: DesignTokens,
    parent: string,
    name: string,
): Edit & { readonly path: string } {
    const path = tokenPath.join(parent, name);
    return { result: create(tokens, path, { group: true }), options: {}, path };
}

export function createTokenEdit(
    tokens: DesignTokens,
    group: Group,
    name: string,
    typedValue: { type: TokenType; value: JsonValue },
): Edit {
    const path = tokenPath.join(group.path, name);
    return { result: create(tokens, path, toNewToken(typedValue, group)), options: {} };
}

export function canAddGroup(name: string): boolean {
    return name !== "";
}

export function canAddToken(name: string, value: JsonValue | undefined): boolean {
    return name !== "" && value !== undefined;
}

export function toNewToken(
    { type, value }: { type: TokenType; value: JsonValue },
    group: Group | undefined,
): NewToken {
    return type === group?.type ? { $value: value } : { $type: type, $value: value };
}
