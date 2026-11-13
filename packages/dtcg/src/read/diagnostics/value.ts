import type { Node } from "jsonc-parser";
import type { Diagnostic } from "../../model/diagnostic.js";
import type { IgnoredProperty } from "../../model/parse.js";
import type { JsonPath } from "../../model/location.js";
import type { ValueErrorDetail } from "../../values/value-errors.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { type JsonFile, deepestNode, propertyKey, toSpan } from "../json/parse.js";

export function valueDiagnostic(
    detail: ValueErrorDetail,
    jsonPath: JsonPath,
    node: Node,
    extra: DiagnosticExtra,
): Diagnostic {
    if (detail.reason === "hex-string" && node.value === detail.value) {
        const { value, asObject } = detail;
        return diagnostic("hex-string-color", { value, asObject }, extra);
    }
    return diagnostic("invalid-value", { jsonPath, ...detail }, extra);
}

export function ignoredDiagnostic(
    { detail }: IgnoredProperty,
    jsonPath: JsonPath,
    within: { node: Node; steps: JsonPath; json: JsonFile },
    extra: DiagnosticExtra,
): Diagnostic {
    const { node, steps, json } = within;
    const shown = propertyKey(node, steps) ?? deepestNode(node, steps);
    const span = toSpan(json, shown);
    return diagnostic(
        "unknown-property",
        { property: detail.property, type: detail.type, jsonPath },
        { ...extra, span },
    );
}
