// A form for editing a border, shadow or typography token one part at a time. Each part gets the
// right control for its type: a color picker for a color, a number and a unit for a size, a
// dropdown for a line style.
import { token, type Document, type TokenType } from "@sugarcube-sh/dtcg";
import { compositeParts, dimensionUnits, strokeStyleKeywords } from "@sugarcube-sh/dtcg/values";

declare const doc: Document;
declare function control(
    label: string,
    type: TokenType | "boolean",
    value: unknown,
    choices?: readonly string[],
): void;

const isComposite = (type: TokenType): type is keyof typeof compositeParts =>
    Object.hasOwn(compositeParts, type);

const choicesFor = (type: TokenType | "boolean") =>
    type === "strokeStyle"
        ? strokeStyleKeywords
        : type === "dimension"
          ? dimensionUnits
          : undefined;

const t = token(doc, "border.card");
const written = t?.authored?.value;
if (t && isComposite(t.type) && written && typeof written === "object") {
    for (const [part, type] of Object.entries(compositeParts[t.type])) {
        control(part, type, (written as Record<string, unknown>)[part], choicesFor(type));
    }
}
