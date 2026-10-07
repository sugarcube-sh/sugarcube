import type { Node } from "jsonc-parser";
import { fixTitles } from "../error-messages.js";
import type { Diagnostic, Fix, IgnoredProperty, JsonPath, ValueErrorDetail } from "../index.js";
import { readAlias } from "../values/references.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { hexAsObject } from "./hex-fix.js";
import { type JsonFile, deepestNode, propertyKey, spanOf } from "./json.js";

export function valueDiagnostic(
    detail: ValueErrorDetail,
    at: JsonPath,
    node: Node,
    file: string,
    extra: DiagnosticExtra,
): Diagnostic {
    const { offset, length } = node;
    if (detail.reason === "hex-string" && node.value === detail.value) {
        const edits = [{ file, offset, length, text: hexAsObject(detail.value) }];
        const fixes = [{ title: fixTitles.hexToObject, safe: true, edits }];
        return diagnostic("hex-string-color", { value: detail.value }, { ...extra, fixes });
    }
    const fix = replacement(detail, node.value);
    const fixes: Fix[] | undefined = fix && [
        { title: fix.title, safe: true, edits: [{ file, offset, length, text: fix.text }] },
    ];
    return diagnostic("invalid-value", { at, ...detail }, { ...extra, ...(fixes && { fixes }) });
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

function replacement(
    detail: ValueErrorDetail,
    written: unknown,
): { title: string; text: string } | undefined {
    if (detail.reason === "string-with-unit" && written === detail.value) {
        const { asObject } = detail;
        if (asObject === undefined) return undefined;
        return {
            title: fixTitles.measureAsObject(detail.type),
            text: `{ "value": ${asObject.value}, "unit": ${JSON.stringify(asObject.unit)} }`,
        };
    }
    if (detail.reason === "hex-not-six-digits" && written === detail.value) {
        const { sixDigits } = detail;
        if (sixDigits === undefined) return undefined;
        return { title: fixTitles.sixDigitHex(sixDigits), text: JSON.stringify(sixDigits) };
    }
    if (detail.reason === "alias-not-allowed-here" && written === detail.reference) {
        const alias = readAlias(written);
        if (!alias) return undefined;
        const steps = alias.alias
            .split(".")
            .map((step) => step.replaceAll("~", "~0").replaceAll("/", "~1"));
        const pointer = `#/${steps.join("/")}/$value`;
        return {
            title: fixTitles.referenceAsPointer(pointer),
            text: `{ "$ref": ${JSON.stringify(pointer)} }`,
        };
    }
    return undefined;
}
