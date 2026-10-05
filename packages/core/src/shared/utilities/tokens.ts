import type { Document, Token } from "@sugarcube-sh/dtcg";
import type { InternalConfig } from "../../types/config.js";
import { entries } from "../css/blocks.js";
import { type Declared, declarationOptions, declarations } from "../css/declarations.js";

export type UtilityVariable = { property: string; name: string };

export type UtilityToken =
    | { token: Token; name: string }
    | { token: Token; variables: UtilityVariable[] }
    | { token: Token; private: boolean };

/**
 * The tokens utility classes can use: each token any permutation in the config's list declares,
 * once, in the order first met, with the name of the variable it declares, or, for a token
 * declared as one variable per CSS property such as typography, each property's variable. Then
 * each token no listed permutation declares, once, saying whether that is because it is private;
 * any other could not be written.
 */
export function utilityTokens(doc: Document, config: InternalConfig): UtilityToken[] {
    const options = declarationOptions(doc, config);
    const permutations = new Set(entries(doc, config).map((entry) => entry.permutation));
    const read = [...permutations].map((permutation) => declarations(permutation, options));
    const listed: UtilityToken[] = [];
    const seen = new Set<string>();
    const add = (each: UtilityToken) => {
        if (seen.has(each.token.path)) return;
        seen.add(each.token.path);
        listed.push(each);
    };
    for (const declared of read) for (const each of declaredIn(declared)) add(each);
    for (const { undeclared } of read) for (const each of undeclared) add(each);
    return listed;
}

function declaredIn({ declarations }: Declared): UtilityToken[] {
    const listed: UtilityToken[] = [];
    const parts = new Map<Token, UtilityVariable[]>();
    for (const { token, name, property } of declarations) {
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
