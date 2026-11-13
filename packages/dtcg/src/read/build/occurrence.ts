import type { JsonPath, Span } from "../../model/index.js";
import type { ReferenceInValue } from "../../values/read-syntax.js";
import { deepestNode, toSpan } from "../json/parse.js";
import type { MergedToken } from "../merge/merge.js";
import { type ReferenceLookup, toPointerSteps } from "../merge/target.js";

export interface Occurrence extends ReferenceLookup {
    property: JsonPath;
    span: Span;
}

export function occurrence(
    token: MergedToken,
    { ref, property, jsonPath }: Pick<ReferenceInValue, "ref" | "property" | "jsonPath">,
): Occurrence {
    const { json, value } = token;
    const node = deepestNode(value, jsonPath.slice(1));
    const span = toSpan(json, node);
    return { reference: ref, steps: toPointerSteps(ref), property, span };
}

export function createAliasOccurrence(token: MergedToken): Occurrence | undefined {
    const { reference } = token;
    return reference && occurrence(token, { ref: reference, property: [], jsonPath: ["$value"] });
}
