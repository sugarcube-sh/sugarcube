import type { JsonPath, Span } from "../index.js";
import type { ReferenceRead } from "../values/read-syntax.js";
import { isAlias } from "../values/references.js";
import { deepestNode, spanOf } from "./json.js";
import type { MergedToken } from "./merge.js";
import { refSteps } from "./pointer.js";

export type Occurrence =
    | { kind: "alias"; target: string; place: JsonPath; at: Span }
    | { kind: "pointer"; written: string; steps: string[] | undefined; place: JsonPath; at: Span };

export function occurrence(
    token: MergedToken,
    { ref, place, at }: Pick<ReferenceRead, "ref" | "place" | "at">,
): Occurrence {
    const { json, value } = token;
    const node = deepestNode(value, at.slice(1), json.hidden);
    const span = spanOf(json.path, json.lineStarts, node.offset, node.length);
    if (isAlias(ref)) return { kind: "alias", target: ref.alias, place, at: span };
    const { pointer: written } = ref;
    return { kind: "pointer", written, steps: refSteps(written), place, at: span };
}

export function wholeReference(token: MergedToken): Occurrence | undefined {
    const { reference } = token;
    return reference && occurrence(token, { ref: reference, place: [], at: ["$value"] });
}
