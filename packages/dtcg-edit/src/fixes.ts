import type { DesignTokens, Diagnostic, Span } from "@sugarcube-sh/dtcg";
import { toJsonPointer, parseReference, toReferenceTarget } from "@sugarcube-sh/dtcg/values";
import { type Node, getNodeValue } from "jsonc-parser";
import { fixTitles } from "./error-messages.js";
import type { Fix, TextEdit } from "./index.js";
import { formatInline, findReferenceString, getRemovalSplices, applySplices } from "./json-text.js";
import { findNode, findEnclosingToken } from "./file-text.js";
import { getDiagnosticsAt } from "@sugarcube-sh/dtcg/editor";

/**
 * Finds the fixes for a diagnostic.
 *
 * A fix that depends on other tokens is offered only if it mends the problem.
 *
 * @param tokens - The design tokens the diagnostic is from.
 * @param diagnostic - One of `tokens.diagnostics`.
 *
 * @example
 * // button.background refers to {color.primry}
 * getFixes(tokens, tokens.diagnostics[0]).map((fix) => fix.title)
 * // => ["use `color.primary`, which has a similar name"]
 */
export function getFixes(tokens: DesignTokens, diagnostic: Diagnostic): Fix[] {
    const fix = findFix(tokens, diagnostic);
    return fix ? [fix] : [];
}

function findFix(tokens: DesignTokens, diagnostic: Diagnostic): Fix | undefined {
    const { span } = diagnostic;
    if (!span) return undefined;

    switch (diagnostic.kind) {
        case "duplicate-key": {
            const earlier = diagnostic.relatedInformation?.[0]?.span;
            const edits =
                earlier && getDeletionEdits(tokens, earlier.file, findNode(tokens, earlier));
            return (
                edits && {
                    title: fixTitles.deleteEarlier(diagnostic.detail.key),
                    isSafe: true,
                    edits,
                }
            );
        }
        case "unknown-type": {
            const { type, suggestion } = diagnostic.detail;
            if (type === "") return deleteEmptyType(tokens, span, findNode(tokens, span));
            if (suggestion === undefined) return undefined;
            return createGuessFix(fixTitles.useSimilar(suggestion), [
                replaceWith(span, suggestion),
            ]);
        }
        case "invalid-property": {
            const { property, reference } = diagnostic.detail;
            if (reference !== undefined) {
                return createGuessFix(fixTitles.writeExtendsAsReference(reference), [
                    replaceWith(span, reference),
                ]);
            }
            const node = findNode(tokens, span);
            if (property !== "$type" || node?.type !== "null") return undefined;
            return deleteEmptyType(tokens, span, node);
        }
        case "hex-string-color": {
            const { value, asObject } = diagnostic.detail;
            if (findNode(tokens, span)?.value !== value) return undefined;
            return createSafeFix(fixTitles.writeHexAsObject, {
                ...toRange(span),
                text: formatInline(asObject),
            });
        }
        case "invalid-value":
            return findValueFix(tokens, diagnostic.detail, span, findNode(tokens, span)?.value);
        case "malformed-pointer":
        case "not-a-value": {
            const { suggestion } = diagnostic.detail;
            const node = findNode(tokens, span);
            const ref = node && findReferenceString(node);
            if (suggestion === undefined || !ref) return undefined;
            const { offset, length } = ref;
            const text = JSON.stringify(suggestion);
            return createSafeFix(fixTitles.writePointer(suggestion), {
                file: span.file,
                offset,
                length,
                text,
            });
        }
        case "unknown-property": {
            const suggestion =
                "suggestion" in diagnostic.detail ? diagnostic.detail.suggestion : undefined;
            if (suggestion === undefined) return undefined;
            return createGuessFix(fixTitles.useSimilar(suggestion), [
                replaceWith(span, suggestion),
            ]);
        }
        case "missing-reference": {
            const { ref, suggestion } = diagnostic.detail;
            if (suggestion === undefined) return undefined;
            const uses = [
                span,
                ...(diagnostic.relatedInformation ?? []).map((related) => related.span),
            ];
            const edits = uses.flatMap((use) => renameReference(tokens, use, ref, suggestion));
            return edits.length > 0
                ? createGuessFix(fixTitles.useSimilar(suggestion), edits)
                : undefined;
        }
        default:
            return undefined;
    }
}

function findValueFix(
    tokens: DesignTokens,
    detail: Extract<Diagnostic, { kind: "invalid-value" }>["detail"],
    span: Span,
    nodeValue: unknown,
): Fix | undefined {
    switch (detail.reason) {
        case "string-with-unit": {
            const { value, asObject, type } = detail;
            if (nodeValue !== value || !asObject) return undefined;
            return createSafeFix(fixTitles.writeMeasureAsObject(type), {
                ...toRange(span),
                text: formatInline(asObject),
            });
        }
        case "hex-not-six-digits": {
            const { value, sixDigits } = detail;
            if (nodeValue !== value || sixDigits === undefined) return undefined;
            return createSafeFix(fixTitles.writeFullHex(sixDigits), replaceWith(span, sixDigits));
        }
        case "short-hex-string": {
            const { value, expanded } = detail;
            if (nodeValue !== value) return undefined;
            return createSafeFix(fixTitles.writeFullHex(expanded), replaceWith(span, expanded));
        }
        case "curly-brace-not-allowed-here": {
            const reference = parseReference(detail.reference);
            if (nodeValue !== detail.reference || reference?.syntax !== "curly-brace") {
                return undefined;
            }
            const pointer = toJsonPointer(reference);
            const change = { ...toRange(span), text: formatInline(pointer) };
            if (!isCleanAfter(tokens, [change])) return undefined;
            return createSafeFix(fixTitles.writeReferenceAsPointer(pointer.$ref), change);
        }
        default:
            return undefined;
    }
}

function deleteEmptyType(
    tokens: DesignTokens,
    span: Span,
    node: Node | undefined,
): Fix | undefined {
    const edits = getDeletionEdits(tokens, span.file, node);
    if (!edits || !isCleanAfter(tokens, edits)) return undefined;
    return { title: fixTitles.deleteType, isSafe: true, edits };
}

function isCleanAfter(tokens: DesignTokens, edits: readonly TextEdit[]): boolean {
    const [first] = edits;
    if (!first) return true;
    const { file } = first;
    const after = tokens.reread({ [file]: applySplices(tokens.getText(file) ?? "", edits) });
    const editStart = Math.min(...edits.map(({ offset }) => offset));
    const token = findEnclosingToken(tokens, file, editStart);
    const start = Math.min(editStart, token?.offset ?? editStart);
    const lengthChange = edits.reduce((acc, { length, text }) => acc + text.length - length, 0);
    const editedEnd = Math.max(...edits.map(({ offset, length }) => offset + length));
    const end = Math.max(editedEnd, token ? token.offset + token.length : editedEnd) + lengthChange;
    return getDiagnosticsAt(after, { file, offset: start, length: end - start }).length === 0;
}

function renameReference(
    tokens: DesignTokens,
    use: Span,
    ref: string,
    suggestion: string,
): TextEdit[] {
    const node = findNode(tokens, use);
    const reference = node && parseReference(getNodeValue(node));
    const text = node && findReferenceString(node);
    if (!reference || !text || toReferenceTarget(reference) !== ref) return [];
    const renamed = reference.syntax === "curly-brace" ? `{${suggestion}}` : suggestion;
    return [
        { file: use.file, offset: text.offset, length: text.length, text: JSON.stringify(renamed) },
    ];
}

function getDeletionEdits(
    tokens: DesignTokens,
    file: string,
    node: Node | undefined,
): TextEdit[] | undefined {
    const text = tokens.getText(file);
    if (!node || text === undefined) return undefined;
    const edits = getRemovalSplices(text, node).map(({ offset, length, text: newText }) => ({
        file,
        offset,
        length,
        text: newText,
    }));
    return edits.length > 0 ? edits : undefined;
}

function toRange({ file, offset, length }: Span): Omit<TextEdit, "text"> {
    return { file, offset, length };
}

function replaceWith(span: Span, value: string): TextEdit {
    return { ...toRange(span), text: JSON.stringify(value) };
}

function createSafeFix(title: string, change: TextEdit): Fix {
    return { title, isSafe: true, edits: [change] };
}

function createGuessFix(title: string, edits: readonly TextEdit[]): Fix {
    return { title, isSafe: false, edits };
}
