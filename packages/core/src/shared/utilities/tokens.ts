import type { Document, Permutation, Token } from "@sugarcube-sh/dtcg";
import type { InternalConfig } from "../../types/config.js";
import { entries } from "../css/blocks.js";
import { type DeclarationOptions, declarationOptions, declarations } from "../css/declarations.js";

export type UtilityVariable = { property: string; name: string };

export type UtilityToken =
    | { token: Token; name: string }
    | { token: Token; variables: UtilityVariable[] };

/**
 * The tokens utility classes can use: each token any permutation in the config's list declares,
 * once, in the order first met, with the name of the variable it declares, or, for a token
 * declared as one variable per CSS property such as typography, each property's variable.
 */
export function utilityTokens(doc: Document, config: InternalConfig): UtilityToken[] {
    const options = declarationOptions(config);
    const listed: UtilityToken[] = [];
    const seen = new Set<string>();
    for (const permutation of new Set(entries(doc, config).map((entry) => entry.permutation))) {
        for (const each of declaredIn(permutation, options)) {
            if (seen.has(each.token.path)) continue;
            seen.add(each.token.path);
            listed.push(each);
        }
    }
    return listed;
}

function declaredIn(permutation: Permutation, options: DeclarationOptions): UtilityToken[] {
    const listed: UtilityToken[] = [];
    const parts = new Map<Token, UtilityVariable[]>();
    for (const { token, name, property } of declarations(permutation, options).declarations) {
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
