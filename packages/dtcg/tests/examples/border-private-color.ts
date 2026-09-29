// Writes a border as CSS when its color points at a private (e.g. not exported as a variable) palette token. That one color is
// written as its value, and every other reference stays a CSS variable. A pointer into part of
// another token's value has no variable of its own, so it is written as its value too.
import {
    isAlias,
    mapReferences,
    resolveReference,
    token,
    type Document,
    type Input,
    type Token,
} from "@sugarcube-sh/dtcg";

declare const doc: Document;
declare const input: Input;
declare function isPrivateToken(t: Token): boolean;
declare function cssName(path: string): string;
declare function renderBorder(value: unknown): string;

const border = token(doc, "border.card", input);
if (border?.type === "border" && border.value) {
    const value = mapReferences(border.value, (ref) => {
        if (!isAlias(ref)) return resolveReference(doc, ref, input);
        const target = token(doc, ref.alias, input);
        return target && isPrivateToken(target) ? target.resolved : `var(--${cssName(ref.alias)})`;
    });
    row(renderBorder(value));
}
