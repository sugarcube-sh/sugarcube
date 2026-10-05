import type { TokenType } from "../index.js";
import { border } from "./border.js";
import { stop } from "./gradient.js";
import { layer } from "./shadow.js";
import type { DefaultNode, LiteralNode, TokenNode } from "./shape.js";
import { transition } from "./transition.js";
import { typography } from "./typography.js";

type Named =
    | (TokenNode & { readonly type: TokenType })
    | (DefaultNode & { readonly shape: LiteralNode & { readonly part: string } });

function partTypes<P extends Readonly<Record<string, Named>>>(composite: {
    readonly properties: P;
}): {
    readonly [K in keyof P]: P[K] extends { kind: "token"; type: infer T }
        ? T
        : P[K] extends { shape: { part: infer N } }
          ? N
          : never;
} {
    const entries = Object.entries(composite.properties).map(([name, part]) => [
        name,
        part.kind === "token" ? part.type : part.shape.part,
    ]);
    return Object.fromEntries(entries) as ReturnType<typeof partTypes<P>>;
}

/**
 * The parts of each composite type, and the type of each part, in the spec's order. For shadow
 * and gradient, these are the parts of one layer or one stop. Every part is required except a
 * shadow's `inset`, which defaults to `false`.
 *
 * @example
 * compositeParts.border // { color: "color", width: "dimension", style: "strokeStyle" }
 */
export const compositeParts = {
    border: partTypes(border),
    transition: partTypes(transition),
    shadow: partTypes(layer),
    gradient: partTypes(stop),
    typography: partTypes(typography),
} as const;
