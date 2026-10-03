// Writes a border as CSS when its color points at a private (e.g. not exported as a variable) palette token. That one color is
// written as its value, and every other reference stays a CSS variable. A pointer into part of
// another token's value has no variable of its own, so it is written as its value too.
import { type Document, type Input, type Part, isAlias, parts, token } from "@sugarcube-sh/dtcg";

declare const doc: Document;
declare const input: Input;
declare function isPrivateToken(t: { path: string }): boolean;
declare function cssName(path: string): string;
declare function cssValue(part: Part): string;

const write = (part: Part): string => {
    const target = part.ref && isAlias(part.ref) ? token(doc, part.ref.alias, input) : undefined;
    return target && !isPrivateToken(target) ? `var(--${cssName(target.path)})` : cssValue(part);
};

const border = token(doc, "border.card", input);
const value = border && parts(border);
if (value?.type === "border") {
    row([value.width, value.style, value.color].map(write).join(" "));
}
