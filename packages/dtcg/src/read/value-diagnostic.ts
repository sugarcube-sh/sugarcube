import type { Node } from "jsonc-parser";
import type { Diagnostic, IgnoredProperty, JsonPath, ValueErrorDetail } from "../index.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { type JsonFile, deepestNode, propertyKey, spanOf } from "./json.js";

export function valueDiagnostic(
    detail: ValueErrorDetail,
    at: JsonPath,
    node: Node,
    extra: DiagnosticExtra,
): Diagnostic {
    if (detail.reason === "hex-string" && node.value === detail.value) {
        const { value, asObject } = detail;
        return diagnostic("hex-string-color", { value, asObject }, extra);
    }
    return diagnostic("invalid-value", { at, ...detail }, extra);
}

export function ignoredDiagnostic(
    { detail }: IgnoredProperty,
    at: JsonPath,
    within: { node: Node; steps: JsonPath; json: JsonFile },
    extra: DiagnosticExtra,
): Diagnostic {
    const { node, steps, json } = within;
    const shown = propertyKey(node, steps, json.hidden) ?? deepestNode(node, steps, json.hidden);
    const span = spanOf(json.path, json.lineStarts, shown.offset, shown.length);
    const found = { property: detail.property, owner: detail.type, at };
    return diagnostic("unknown-property", found, { ...extra, at: span });
}
