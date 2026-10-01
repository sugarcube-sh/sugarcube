import type { Node } from "jsonc-parser";
import { fixTitles } from "../error-messages.js";
import type { Diagnostic, Fix, JsonPath, ValueErrorDetail } from "../index.js";
import { STRING_WITH_UNIT } from "../values/measure.js";
import { readAlias } from "../values/references.js";
import { dimensionUnits, durationUnits } from "../values/units.js";
import { type DiagnosticExtra, diagnostic } from "./diagnostics.js";
import { hexAsObject } from "./hex-fix.js";

const THREE_DIGIT_HEX = /^#[0-9a-f]{3}$/i;

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

function replacement(
    detail: ValueErrorDetail,
    written: unknown,
): { title: string; text: string } | undefined {
    if (detail.reason === "string-with-unit" && written === detail.value) {
        const [, number, unit] = STRING_WITH_UNIT.exec(written) ?? [];
        const units: readonly string[] =
            detail.type === "duration" ? durationUnits : dimensionUnits;
        if (number === undefined || unit === undefined || !units.includes(unit)) return undefined;
        return {
            title: fixTitles.measureAsObject(detail.type),
            text: `{ "value": ${Number(number)}, "unit": ${JSON.stringify(unit)} }`,
        };
    }
    if (detail.reason === "hex-not-six-digits" && typeof written === "string") {
        if (written !== detail.value || !THREE_DIGIT_HEX.test(written)) return undefined;
        const hex = `#${Array.from(written.slice(1), (digit) => digit + digit).join("")}`;
        return { title: fixTitles.sixDigitHex(hex), text: JSON.stringify(hex) };
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
