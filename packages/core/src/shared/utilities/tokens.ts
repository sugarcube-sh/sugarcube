import type { Document, Token, TokenType } from "@sugarcube-sh/dtcg";
import type { InternalConfig } from "../../types/config.js";
import { entries } from "../css/blocks.js";
import { declarationOptions, declarations } from "../css/declarations.js";

export type UtilityVariable = { property: string; name: string };

export type UtilityToken =
    | { path: string; type: TokenType; name: string }
    | { path: string; type: TokenType; variables: UtilityVariable[] };

/**
 * The tokens utility classes can use: each token the first permutation in the config's list
 * declares, in file order, with the name of the variable it declares, or, for a token declared as
 * one variable per CSS property such as typography, each property's variable.
 */
export function utilityTokens(doc: Document, config: InternalConfig): UtilityToken[] {
    const [first] = entries(doc, config);
    if (!first) return [];
    const listed: UtilityToken[] = [];
    const parts = new Map<Token, UtilityVariable[]>();
    for (const { token, name, property } of declarations(
        first.permutation,
        declarationOptions(config),
    ).declarations) {
        const { path, type } = token;
        if (property === undefined) {
            listed.push({ path, type, name });
            continue;
        }
        const variables = parts.get(token);
        if (variables) {
            variables.push({ property, name });
            continue;
        }
        const firstPart = [{ property, name }];
        parts.set(token, firstPart);
        listed.push({ path, type, variables: firstPart });
    }
    return listed;
}
