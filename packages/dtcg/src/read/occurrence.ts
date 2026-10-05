import type { JsonPath, Span } from "../index.js";
import type { Found } from "../values/read-shape.js";
import { isAlias } from "../values/references.js";
import { deepestNode, member, spanOf } from "./json.js";
import type { MergedToken } from "./merge.js";
import { refSteps } from "./pointer.js";

export type Occurrence =
    | { kind: "alias"; target: string; place: JsonPath; at: Span }
    | {
          kind: "pointer";
          written: string;
          steps: string[] | undefined;
          place: JsonPath;
          at: Span;
          pointerAt: Span;
      };

export function occurrence(
    token: MergedToken,
    { ref, place, at }: Pick<Found, "ref" | "place" | "at">,
): Occurrence {
    const { json, value } = token;
    const node = deepestNode(value, at.slice(1), json.hidden);
    const span = spanOf(json.path, json.lineStarts, node.offset, node.length);
    if (isAlias(ref)) return { kind: "alias", target: ref.alias, place, at: span };
    const text = member(node, "$ref", json.hidden) ?? node;
    const pointerAt = spanOf(json.path, json.lineStarts, text.offset, text.length);
    const { pointer: written } = ref;
    return { kind: "pointer", written, steps: refSteps(written), place, at: span, pointerAt };
}

export function wholeReference(token: MergedToken): Occurrence | undefined {
    const { reference } = token;
    return reference && occurrence(token, { ref: reference, place: [], at: ["$value"] });
}
