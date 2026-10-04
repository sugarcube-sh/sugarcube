import type { Document, Token } from "@sugarcube-sh/dtcg";
import type { InternalConfig } from "../../types/config.js";
import { entries } from "../css/blocks.js";
import { declarationOptions, declarations } from "../css/declarations.js";

export type UtilityVariable = { property: string; name: string };

export type UtilityToken =
    | { token: Token; name: string }
    | { token: Token; variables: UtilityVariable[] };

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
        if (property === undefined) {
            listed.push({ token, name });
            continue;
        }
        const variables = parts.get(token);
        if (variables) {
            variables.push({ property, name });
            continue;
        }
        const firstPart = [{ property, name }];
        parts.set(token, firstPart);
        listed.push({ token, variables: firstPart });
    }
    return listed;
}
