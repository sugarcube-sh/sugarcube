import type { Token } from "@sugarcube-sh/dtcg";
import type { CSSDeclarations } from "@sugarcube-sh/dtcg/css";
import type { Declarations } from "../css/declare.js";

export type UtilityVariable = { property: string; name: string };

/**
 * A token utility classes can use, with its variable.
 *
 * - `name` is its variable's name, such as `"--color-primary"`.
 * - `variables` has a variable for each CSS property, for a typography token.
 * - `private` is set for a token no permutation declares. It's `true` when the token isn't written.
 */
export type UtilityToken =
    | { token: Token; name: string }
    | { token: Token; variables: UtilityVariable[] }
    | { token: Token; private: boolean };

/**
 * Gets the tokens utility classes can use, with each one's variable.
 *
 * @param declared - The variables from `declare`.
 *
 * @example
 * getUtilityTokens(declare(tokens, config)).map(({ token }) => token.path)
 * // => ["color.blue.500", "color.blue.300", "color.primary", "button.background", "space.sm", "space.md"]
 */
export function getUtilityTokens({ entries }: Declarations): UtilityToken[] {
    const declarations = [...new Set(entries.map(({ declared }) => declared))];
    const utilityTokens: UtilityToken[] = [];
    const seen = new Set<string>();
    const add = (each: UtilityToken) => {
        if (seen.has(each.token.path)) return;
        seen.add(each.token.path);
        utilityTokens.push(each);
    };
    for (const declared of declarations)
        for (const each of getDeclaredUtilityTokens(declared)) add(each);
    for (const { undeclared } of declarations) {
        for (const { token, reason } of undeclared) add({ token, private: reason === "skipped" });
    }
    return utilityTokens;
}

function getDeclaredUtilityTokens({ declarations }: CSSDeclarations): UtilityToken[] {
    const listed: UtilityToken[] = [];
    const parts = new Map<Token, UtilityVariable[]>();
    for (const { token, name, cssProperty: property } of declarations) {
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
