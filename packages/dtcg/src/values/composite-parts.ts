import type { TokenType } from "../model.js";
import { border } from "./syntaxes/border.js";
import { stop } from "./syntaxes/gradient.js";
import { layer } from "./syntaxes/shadow.js";
import type { LiteralSyntax, OfTypeSyntax, WithDefault } from "./syntax.js";
import { transition } from "./syntaxes/transition.js";
import { typography } from "./syntaxes/typography.js";

type PartSyntax =
    | (OfTypeSyntax & { readonly type: TokenType })
    | (WithDefault & { readonly syntax: LiteralSyntax & { readonly part: string } });

function partTypes<P extends Readonly<Record<string, PartSyntax>>>(composite: {
    readonly properties: P;
}): {
    readonly [K in keyof P]: P[K] extends { kind: "ofType"; type: infer T }
        ? T
        : P[K] extends { syntax: { part: infer N } }
          ? N
          : never;
} {
    const entries = Object.entries(composite.properties).map(([name, part]) => [
        name,
        part.kind === "ofType" ? part.type : part.syntax.part,
    ]);
    return Object.fromEntries(entries) as ReturnType<typeof partTypes<P>>;
}

/**
 * The parts of each composite type, and each part's type.
 *
 * A shadow's parts are one layer's. A gradient's are one stop's.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#composite-types | Format 9, Composite types}
 *
 * @example
 * // A border's parts
 * compositeParts.border
 * // => { color: "color", width: "dimension", style: "strokeStyle" }
 */
export const compositeParts = {
    border: partTypes(border),
    transition: partTypes(transition),
    shadow: partTypes(layer),
    gradient: partTypes(stop),
    typography: partTypes(typography),
} as const;
