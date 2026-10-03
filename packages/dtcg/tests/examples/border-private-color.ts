// Writes a border as CSS when its color points at a private (e.g. not exported as a variable) palette token. That one color is
// written as its value, and every other reference stays a CSS variable. A pointer into part of
// another token's value has no variable of its own, so it is written as its value too.
import {
    type Document,
    type Input,
    type JsonPath,
    type Token,
    isAlias,
    references,
    token,
} from "@sugarcube-sh/dtcg";

declare const doc: Document;
declare const input: Input;
declare function isPrivateToken(t: Token): boolean;
declare function cssName(path: string): string;
declare function cssValue(part: unknown): string;

const border = token(doc, "border.card", input);
if (border?.type === "border" && border.resolved) {
    const found = references(border);
    const part = (at: JsonPath, resolved: unknown) => {
        const ref = found.find((each) => each.at.join("/") === at.join("/"))?.ref;
        const target = ref && isAlias(ref) ? token(doc, ref.alias, input) : undefined;
        return target && !isPrivateToken(target)
            ? `var(--${cssName(target.path)})`
            : cssValue(resolved);
    };
    const { width, style, color } = border.resolved;
    row(`${part(["width"], width)} ${part(["style"], style)} ${part(["color"], color)}`);
}
